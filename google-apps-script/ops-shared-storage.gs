/**
 * ICBANQ OPS Portal shared storage for Google Sheets.
 *
 * 1. Create a Google Sheet.
 * 2. Extensions > Apps Script.
 * 3. Paste this file.
 * 4. Set Script Property:
 *    OPS_SHARED_STORAGE_SECRET = the same value used in Vercel.
 * 5. Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone with the link
 */

const CONFIG_SHEET_NAME = "OPS_STORAGE";
const ALLOWED_COLLECTIONS = [
  "requests",
  "monthEndSnapshot",
  "monthEndSnapshots",
  "monthEndHomeSummary",
  "monthEndRma",
  "monthEndRmaHistory",
  "receivablesAging",
  "receivablesAgingHistory",
  "receivablesStatus",
  "receivablesStatusHistory",
  "receivablesMatching",
  "blockedUsers"
];
const ALLOWED_COLLECTION_PREFIXES = [
  "monthEndSnapshot__chunk_",
  "monthEndSnapshots__chunk_"
];

function doGet(e) {
  return jsonOutput({
    ok: true,
    message: "ICBANQ OPS storage is reachable",
    time: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("OPS_SHARED_STORAGE_SECRET") || "";

    if (expectedSecret && payload.secret !== expectedSecret) {
      return jsonOutput({ ok: false, message: "Unauthorized" });
    }

    if (payload.action === "getOpsProgress" || payload.action === "saveOpsProgress") {
      return jsonOutput(handleOpsProgress(payload));
    }

    const collection = String(payload.collection || "").trim();
    if (!isAllowedCollection(collection)) {
      return jsonOutput({ ok: false, message: "Unknown collection" });
    }

    if (payload.action === "get") {
      return jsonOutput({ ok: true, data: readCollection(collection) });
    }

    if (payload.action === "set") {
      writeCollection(collection, payload.data);
      return jsonOutput({ ok: true });
    }

    return jsonOutput({ ok: false, message: "Unknown action" });
  } catch (error) {
    return jsonOutput({ ok: false, message: String(error && error.message ? error.message : error) });
  }
}

function isAllowedCollection(collection) {
  if (ALLOWED_COLLECTIONS.includes(collection)) return true;
  return ALLOWED_COLLECTION_PREFIXES.some(function(prefix) {
    return collection.indexOf(prefix) === 0;
  });
}

function jsonOutput(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function getStorageSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG_SHEET_NAME);
    sheet.appendRow(["collection", "json", "updatedAt"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findCollectionRow(sheet, collection) {
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0]) === collection) return index + 1;
  }
  return -1;
}

function readCollection(collection) {
  const sheet = getStorageSheet();
  const row = findCollectionRow(sheet, collection);
  if (row < 0) return null;
  const raw = sheet.getRange(row, 2).getValue();
  return raw ? JSON.parse(raw) : null;
}

function writeCollection(collection, data) {
  const sheet = getStorageSheet();
  const row = findCollectionRow(sheet, collection);
  const json = JSON.stringify(data || null);
  const updatedAt = new Date().toISOString();

  if (row < 0) {
    sheet.appendRow([collection, json, updatedAt]);
    return;
  }

  sheet.getRange(row, 2, 1, 2).setValues([[json, updatedAt]]);
}

function handleOpsProgress(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName("OPS_PROGRESS");
    if (!sheet) {
      sheet = spreadsheet.insertSheet("OPS_PROGRESS");
      sheet.appendRow(["key", "cycle", "date", "task", "subject", "status", "evidence", "updatedBy", "updatedAt"]);
      sheet.setFrozenRows(1);
    }
    const rows = sheet.getDataRange().getValues();
    if (payload.action === "getOpsProgress") {
      const subjects = Array.isArray(payload.subjects) ? payload.subjects : [];
      const records = rows.slice(1).filter(function(row) {
        return String(row[1]) === payload.cycle && subjects.includes(String(row[4]));
      }).map(function(row) {
        return { cycle: String(row[1]), date: String(row[2]), task: String(row[3]), subject: String(row[4]), status: String(row[5]), evidence: JSON.parse(String(row[6]) || "[]"), updatedBy: String(row[7]), updatedAt: String(row[8]) };
      });
      return { ok: true, data: records };
    }
    const record = payload.record;
    if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !Array.isArray(record.evidence) || !["complete", "in_progress", "incomplete", "auto"].includes(record.status)) throw new Error("Invalid progress record");
    const key = [record.cycle, record.date, record.task, record.subject].join("|");
    const evidence = JSON.stringify(record.evidence);
    if (evidence.length > 45000) throw new Error("Progress evidence is too large");
    const values = [key, record.cycle, record.date, record.task, record.subject, record.status, evidence, record.updatedBy, record.updatedAt];
    const existing = rows.findIndex(function(row) { return String(row[0]) === key; });
    const rowIndex = existing < 0 ? sheet.getLastRow() + 1 : existing + 1;
    sheet.getRange(rowIndex, 1, 1, values.length).setNumberFormat("@").setValues([values]);
    return { ok: true, data: record };
  } finally {
    lock.releaseLock();
  }
}
