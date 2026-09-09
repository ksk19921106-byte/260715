import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { NextResponse } from "next/server";
import type { MonthEndRmaRecord, MonthEndRmaSnapshot } from "../../services/monthEndRma";
import { readSharedCollection, writeSharedCollection } from "../../services/sharedStorageServer";
import { isLiveAuthEnabled } from "../../services/authMode";
import { canViewSalesName, forbidden, getAuthenticatedPortalUser, isVipsUser, unauthorized } from "../../services/authServer";
import type { PortalUser } from "../../services/portalUsers";

export const runtime = "nodejs";

const snapshotPath = path.join(process.cwd(), "data", "month-end-rma.json");
const historyPath = path.join(process.cwd(), "data", "month-end-rma-history.json");

function scopeSnapshot(snapshot: MonthEndRmaSnapshot | null, user: PortalUser | null) {
  if (!snapshot || !user || isVipsUser(user)) return snapshot;
  return { ...snapshot, records: snapshot.records.filter((record) => canViewSalesName(user, record.sales)) };
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

async function readSnapshotFile() {
  const sharedSnapshot = await readSharedCollection<MonthEndRmaSnapshot>("monthEndRma");
  if (sharedSnapshot?.id && Array.isArray(sharedSnapshot.records)) return sharedSnapshot;

  try {
    return JSON.parse(await readFile(snapshotPath, "utf8")) as MonthEndRmaSnapshot;
  } catch {
    return null;
  }
}

function snapshotMonth(snapshot: MonthEndRmaSnapshot) {
  const raw = String(snapshot.uploadedAt || "");
  const match = raw.match(/(20\d{2})[-./년\s]*(0?[1-9]|1[0-2])/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

function latestSnapshot(snapshots: MonthEndRmaSnapshot[]) {
  return [...snapshots].sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))[0] ?? null;
}

async function readHistoryFile() {
  const sharedHistory = await readSharedCollection<MonthEndRmaSnapshot[]>("monthEndRmaHistory");
  if (Array.isArray(sharedHistory)) return sharedHistory.filter((snapshot) => snapshot?.id && Array.isArray(snapshot.records));

  try {
    const raw = await readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((snapshot) => snapshot?.id && Array.isArray(snapshot.records));
  } catch {
    // Fall back to the legacy latest snapshot below.
  }

  const latest = await readSnapshotFile();
  return latest ? [latest] : [];
}

async function writeHistoryFile(history: MonthEndRmaSnapshot[]) {
  await writeSharedCollection("monthEndRmaHistory", history);

  try {
    await mkdir(path.dirname(historyPath), { recursive: true });
    await writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

async function writeSnapshotFile(snapshot: MonthEndRmaSnapshot) {
  await writeSharedCollection("monthEndRma", snapshot);
  const history = await readHistoryFile();
  await writeHistoryFile([snapshot, ...history.filter((item) => item.id !== snapshot.id)]);

  try {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function rowsToObjects(rows: string[][]) {
  const headers = rows[0]?.map((cell) => cell.trim()) ?? [];
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell).trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseCsv(text: string) {
  const cleaned = text.replace(/^\uFEFF/, "");
  return rowsToObjects(cleaned.split(/\r?\n/).filter(Boolean).map(parseCsvLine));
}

function unzip(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return files;

  const centralDirOffset = buffer.readUInt32LE(eocd + 16);
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = centralDirOffset;

  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    files.set(fileName, method === 8 ? inflateRawSync(compressed) : compressed);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si[\s\S]*?<\/si>/g)).map((match) =>
    xmlDecode(Array.from(match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((item) => item[1]).join(""))
  );
}

function columnIndex(ref: string) {
  const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, index - 1);
}

function parseSheet(xml: string, sharedStrings: string[]) {
  return Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)).map((rowMatch) => {
    const row: string[] = [];
    for (const cellMatch of Array.from(rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g))) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/r="([^"]+)"/)?.[1] ?? "";
      const targetIndex = columnIndex(ref);
      while (row.length < targetIndex) row.push("");
      const inline = body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      row[targetIndex] = attrs.includes('t="s"') ? sharedStrings[Number(value)] ?? "" : xmlDecode(inline ?? value);
    }
    return row;
  });
}

function parseXlsx(buffer: Buffer) {
  const files = unzip(buffer);
  const sheetName = Array.from(files.keys()).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const sheet = sheetName ? files.get(sheetName) : null;
  if (!sheet) return [];
  const sharedStringsXml = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  return rowsToObjects(parseSheet(sheet.toString("utf8"), sharedStrings));
}

function pick(row: Record<string, string>, keys: string[]) {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/\s+/g, ""), value]));
  for (const key of keys) {
    const direct = row[key];
    if (direct !== undefined) return direct;
    const normalizedKey = key.toLowerCase().replace(/\s+/g, "");
    if (normalized[normalizedKey] !== undefined) return normalized[normalizedKey];
  }
  return "";
}

function normalizeRecord(row: Record<string, string>, index: number, uploadedAt: string, uploadedBy: string): MonthEndRmaRecord {
  return {
    id: `RMA-${Date.now()}-${String(index + 1).padStart(4, "0")}`,
    sales: asText(pick(row, ["Sales", "SALES", "sales", "담당자", "영업"])),
    supplier: asText(pick(row, ["Supplier", "SUPPLIER", "supplier", "공급처", "업체명"])),
    purchaseStatus: asText(pick(row, ["P.status", "P Status", "P상태", "Purchase Status"])),
    warehouseStatus: asText(pick(row, ["W.status", "W Status", "W상태", "Warehouse Status"])),
    uploadedAt,
    uploadedBy
  };
}

export async function GET(request: Request) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const history = await readHistoryFile();
  const scopedHistory = month ? history.filter((snapshot) => snapshotMonth(snapshot) === month) : history;
  const snapshot = latestSnapshot(scopedHistory) ?? await readSnapshotFile();
  return NextResponse.json({ snapshot: scopeSnapshot(snapshot, authUser), history: authUser ? history.map((item) => scopeSnapshot(item, authUser)) : history });
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  if (authUser && !isVipsUser(authUser)) return forbidden("RMA 원본 데이터는 VIPS만 업로드할 수 있습니다.");
  const formData = await request.formData();
  const file = formData.get("file");
  const uploadedBy = asText(formData.get("uploadedBy")) || "Admin";

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "업로드할 RMA 파일이 없습니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();
  const rows = lowerName.endsWith(".xlsx") ? parseXlsx(buffer) : parseCsv(buffer.toString("utf8"));
  const uploadedAt = new Date().toISOString();
  const records = rows
    .map((row, index) => normalizeRecord(row, index, uploadedAt, uploadedBy))
    .filter((record) => record.sales || record.supplier || record.purchaseStatus || record.warehouseStatus);

  if (records.length === 0) {
    return NextResponse.json({ message: "RMA 데이터를 인식하지 못했습니다. Sales, Supplier, P.status, W.status 컬럼을 확인해주세요." }, { status: 400 });
  }

  const snapshot: MonthEndRmaSnapshot = {
    id: `rma-${uploadedAt}`,
    uploadedAt,
    uploadedBy,
    fileName: file.name,
    records
  };

  await writeSnapshotFile(snapshot);
  return NextResponse.json({ ok: true, snapshot });
}
