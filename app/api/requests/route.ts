import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { REQUEST_FORM_CONFIGS, type RequestFormValues, type RequestKind } from "../../services/formValidation";
import type { ErpTransmissionLog, RequestAttachmentPreview, RequestCreatePayload, RequestItem, RequestStatus, RequestUpdatePayload } from "../../services/requestStorage";
import { isSharedStorageConfigured, readSharedCollection, writeSharedCollection } from "../../services/sharedStorageServer";
import { isLiveAuthEnabled } from "../../services/authMode";
import { canViewSalesName, getAuthenticatedPortalUser, isVipsUser, unauthorized } from "../../services/authServer";
import { getPortalUserByEmail, getPortalUserByName, type PortalUser } from "../../services/portalUsers";

export const runtime = "nodejs";

type RequestRow = RequestItem & {
  contactEmail: string;
};

function requestOwner(row: RequestRow) {
  if (row.requesterSalesName) return getPortalUserByName(row.requesterSalesName);
  return getPortalUserByEmail(row.requester) ?? getPortalUserByName(row.requester);
}

function canViewRequestRow(row: RequestRow, user: PortalUser) {
  if (isVipsUser(user)) return true;
  if (row.requester.toLowerCase() === user.email.toLowerCase()) return true;
  if (row.requesterSalesName) return canViewSalesName(user, row.requesterSalesName);
  const owner = requestOwner(row);
  return owner ? canViewSalesName(user, owner.salesName) : false;
}

const dataDir = path.join(process.cwd(), "data");
const jsonPath = path.join(dataDir, "requests.json");
const xlsxPath = path.join(dataDir, "icbanq-ops-requests.xlsx");

const excelHeaders = [
  "요청ID",
  "요청종류",
  "업체명",
  "요청자",
  "요청일시",
  "상태",
  "처리결과",
  "담당자이메일",
  "발행일자",
  "품목명",
  "수량",
  "단가",
  "공급가액",
  "총금액",
  "비고",
  "처리자",
  "처리일시",
  "배정담당자",
  "상세정보",
  "ERP전송정보"
];

function normalizeStatus(status: string | undefined): RequestStatus {
  if (status === "처리중" || status === "VIPS팀 확인중") return "VIPS팀 확인중";
  if (status === "완료") return "완료";
  if (status === "반려") return "반려";
  return "요청접수";
}

function normalizeKind(kind: string | undefined, type: string): RequestKind {
  if (kind && kind in REQUEST_FORM_CONFIGS) return kind as RequestKind;
  if (type.includes("수정")) return "revisedTaxInvoice";
  if (type.includes("역발행")) return "reverseIssueApproval";
  if (type.includes("선수금") || type.includes("입금")) return "advancePayment";
  if (type.includes("카드")) return "cardPayment";
  if (type.includes("보증보험")) return "guaranteeInsurance";
  if (type.includes("계산서매칭")) return "invoiceMatching";
  if (type.includes("수금매칭")) return "collectionMatching";
  if (type.includes("월마감")) return "monthEndCheck";
  return "taxInvoice";
}

function asText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function asDetails(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, asText(item)]));
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return asDetails(parsed);
    } catch {
      return {};
    }
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return asStringArray(parsed);
    } catch {
      // comma separated legacy value
    }
    return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function asAttachments(value: unknown): RequestAttachmentPreview[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => item as Partial<RequestAttachmentPreview>)
      .filter((item) => item.name && item.dataUrl)
      .map((item) => ({
        field: asText(item.field),
        label: asText(item.label, "첨부파일"),
        name: asText(item.name),
        type: asText(item.type),
        dataUrl: asText(item.dataUrl)
      }));
  }
  if (typeof value === "string") {
    try {
      return asAttachments(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function buildAttachments(values: RequestFormValues): RequestAttachmentPreview[] {
  const source = values as unknown as Record<string, string>;
  return Object.entries(source)
    .filter(([key, value]) => key.endsWith("PreviewData") && value)
    .map(([key, dataUrl]) => {
      const field = key.replace(/PreviewData$/, "");
      return {
        field,
        label: source[`${field}PreviewLabel`] || "첨부파일",
        name: source[field] || "첨부파일",
        type: source[`${field}PreviewType`] || "",
        dataUrl
      };
    });
}

function pick(row: Record<string, unknown>, keys: string[], fallback = "") {
  const key = keys.find((candidate) => row[candidate] !== undefined);
  return key ? asText(row[key], fallback) : fallback;
}

function legacyRowToRequest(row: Record<string, unknown>): RequestRow {
  const legacy = Object.values(row).map((value) => asText(value));
  const type = pick(row, ["type", "요청종류"], legacy[1] ?? "세금계산서 요청");

  return {
    id: pick(row, ["id", "요청ID"], legacy[0] ?? ""),
    type,
    kind: normalizeKind(pick(row, ["kind"], ""), type),
    companyName: pick(row, ["companyName", "업체명"], legacy[2] ?? "-"),
    requester: pick(row, ["requester", "요청자"], legacy[3] ?? "Sally"),
    requesterSalesName: pick(row, ["requesterSalesName", "요청 Sales"], "") || undefined,
    requesterTeam: pick(row, ["requesterTeam", "요청 팀"], "") || undefined,
    requestedAt: pick(row, ["requestedAt", "요청일시"], legacy[4] ?? "-"),
    status: normalizeStatus(pick(row, ["status", "상태"], legacy[5] ?? "요청접수")),
    result: pick(row, ["result", "처리결과"], legacy[6] ?? "-"),
    contactEmail: pick(row, ["contactEmail", "담당자이메일"], legacy[7] ?? ""),
    issueDate: pick(row, ["issueDate", "발행일자"], legacy[8] ?? ""),
    itemName: pick(row, ["itemName", "품목명"], legacy[9] ?? ""),
    quantity: pick(row, ["quantity", "수량"], legacy[10] ?? ""),
    unitPrice: pick(row, ["unitPrice", "단가"], legacy[11] ?? ""),
    supplyAmount: pick(row, ["supplyAmount", "공급가액"], legacy[12] ?? ""),
    totalAmount: pick(row, ["totalAmount", "총금액"], legacy[13] ?? ""),
    note: pick(row, ["note", "비고"], legacy[14] ?? ""),
    processor: pick(row, ["processor", "처리자"], legacy[15] ?? "-"),
    processedAt: pick(row, ["processedAt", "처리일시"], legacy[16] ?? "-"),
    assignedOwners: asStringArray(row.assignedOwners ?? row.배정담당자 ?? legacy[17]),
    attachments: asAttachments(row.attachments ?? row.첨부미리보기),
    details: asDetails(row.details ?? row.상세정보 ?? legacy[18]),
    erpTransmission: asErpTransmission(row.erpTransmission ?? row.ERP전송정보 ?? legacy[19])
  };
}

function asErpTransmission(value: unknown): ErpTransmissionLog | undefined {
  if (!value) return undefined;
  if (typeof value === "object" && !Array.isArray(value)) {
    const item = value as Partial<ErpTransmissionLog>;
    return {
      status: item.status ?? "not_ready",
      system: item.system ?? "ICBANQ_ERP",
      mode: item.mode ?? "mock",
      transmittedAt: asText(item.transmittedAt),
      transmittedBy: asText(item.transmittedBy),
      externalId: asText(item.externalId),
      message: asText(item.message, "ERP 전송 정보"),
      payload: typeof item.payload === "object" && item.payload ? item.payload as Record<string, unknown> : undefined
    };
  }
  if (typeof value === "string") {
    try {
      return asErpTransmission(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function rowToItem(row: RequestRow): RequestItem {
  const { contactEmail: _contactEmail, ...item } = row;
  return item;
}

function formatRequestedAt(date: Date) {
  return date
    .toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}

function createRequestId(date: Date, count: number) {
  const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `REQ-${yyyymmdd}-${String(count + 1).padStart(3, "0")}`;
}

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

async function readRows(): Promise<RequestRow[]> {
  const sharedRows = await readSharedCollection<Array<Record<string, unknown>>>("requests");
  if (Array.isArray(sharedRows)) return sharedRows.map(legacyRowToRequest);

  try {
    const parsed = JSON.parse(await readFile(jsonPath, "utf8")) as Array<Record<string, unknown>>;
    return parsed.map(legacyRowToRequest);
  } catch {
    return [];
  }
}

async function writeRows(rows: RequestRow[]) {
  const sharedRows = rows.map((row) => ({
    ...row,
    // File previews are useful during form entry, but base64 data can make a
    // Google Sheets row too large. Keep request records durable and lightweight.
    attachments: []
  }));
  const sharedSaved = await writeSharedCollection("requests", sharedRows);
  if (isSharedStorageConfigured() && !sharedSaved) {
    throw new Error("Google Sheets request storage save failed");
  }

  try {
    await mkdir(dataDir, { recursive: true });
    await writeFile(jsonPath, JSON.stringify(rows, null, 2), "utf8");
    await writeFile(xlsxPath, createWorkbook(rows));
  } catch {
    // Vercel file system is not persistent. Shared storage is the source of truth when configured.
  }
}

function rowValues(row: RequestRow) {
  return [
    row.id,
    row.type,
    row.companyName,
    row.requester,
    row.requestedAt,
    row.status,
    row.result,
    row.contactEmail,
    row.issueDate,
    row.itemName,
    row.quantity,
    row.unitPrice,
    row.supplyAmount,
    row.totalAmount,
    row.note,
    row.processor,
    row.processedAt,
    (row.assignedOwners ?? []).join(", "),
    JSON.stringify(row.details ?? {}),
    JSON.stringify(row.erpTransmission ?? {})
  ];
}

function parseMoneyLike(value: string) {
  return Number(String(value ?? "").replace(/[^0-9.-]/g, "") || 0);
}

function buildErpPayload(row: RequestRow) {
  const details = row.details ?? {};
  if (row.kind === "taxInvoice") {
    return {
      requestId: row.id,
      requestType: "taxInvoice",
      companyName: row.companyName,
      contactEmail: details["담당자(E메일)"] || row.contactEmail,
      issueDate: row.issueDate,
      itemName: row.itemName,
      quantity: parseMoneyLike(row.quantity),
      unitPrice: parseMoneyLike(row.unitPrice),
      supplyAmount: parseMoneyLike(row.supplyAmount),
      vatAmount: parseMoneyLike(details["부가세액"] || ""),
      totalAmount: parseMoneyLike(row.totalAmount),
      trackingMatchStatus: details["트래킹 매칭 여부"] || "",
      trackingNumber: details["트래킹 번호"] || "",
      trackingMemo: details["트래킹 매칭 관련 메모"] || "",
      note: row.note,
      requestedBy: row.requester
    };
  }

  if (row.kind === "revisedTaxInvoice") {
    return {
      requestId: row.id,
      requestType: "revisedTaxInvoice",
      revisionRequestType: details["구분"] || "",
      originalInvoiceLink: details["기존세금계산서링크"] || "",
      revisionChange: details["수정사항"] || row.itemName,
      revisionReason: details["수정이유"] || "",
      note: row.note,
      requestedBy: row.requester
    };
  }

  if (row.kind === "advancePayment") {
    return {
      requestId: row.id,
      requestType: "advancePayment",
      advanceUsageType: details["처리구분"] || "",
      ikiTaxId: details["IKI Tax ID"] || "",
      advancePaymentLink: details["선수금링크"] || "",
      collectionLink: details["수금링크"] || "",
      poLink: details["PO링크"] || "",
      gpAmount: parseMoneyLike(details["G/P"] || row.supplyAmount),
      spAmount: parseMoneyLike(details["S/P"] || ""),
      upAmount: parseMoneyLike(details["U/P"] || ""),
      note: row.note,
      requestedBy: row.requester
    };
  }

  return null;
}

function buildMockErpTransmission(row: RequestRow, payload: RequestUpdatePayload, processedAt: string): ErpTransmissionLog {
  const erpPayload = buildErpPayload(row);
  if (!erpPayload) {
    return {
      status: "failed",
      system: payload.targetSystem ?? "ICBANQ_ERP",
      mode: "mock",
      transmittedAt: processedAt,
      transmittedBy: payload.transmittedBy || "VIPS팀",
      message: "ERP 처리 대상 요청이 아닙니다."
    };
  }

  return {
    status: "mock_sent",
    system: payload.targetSystem ?? "ICBANQ_ERP",
    mode: "mock",
    transmittedAt: processedAt,
    transmittedBy: payload.transmittedBy || "VIPS팀",
    externalId: `MOCK-ERP-${row.id.replace(/^REQ-/, "")}`,
    message: "Mock ERP 처리 승인 완료. 실제 ERP API URL/인증키 연결 시 같은 payload로 사내 ERP 수동발행/선수금 처리에 연결됩니다.",
    payload: erpPayload
  };
}

function sheetXml(rows: RequestRow[]) {
  const allRows = [excelHeaders, ...rows.map(rowValues)];
  const xmlRows = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const ref = `${columnName(colIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(String(value ?? ""))}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
}

function createWorkbook(rows: RequestRow[]) {
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="VIPS Requests" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    "xl/worksheets/sheet1.xml": sheetXml(rows)
  };

  return zipStore(files);
}

function zipStore(files: Record<string, string>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content]) => {
    const nameBuffer = Buffer.from(name);
    const contentBuffer = Buffer.from(content, "utf8");
    const crc = crc32(contentBuffer);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(contentBuffer.length, 18);
    local.writeUInt32LE(contentBuffer.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, contentBuffer);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(contentBuffer.length, 20);
    central.writeUInt32LE(contentBuffer.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + contentBuffer.length;
  });

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

let crcTable: number[] | undefined;

function crc32(buffer: Buffer) {
  crcTable ??= Array.from({ length: 256 }, (_, index) => {
    let c = index;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });

  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    const byte = buffer[index];
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function money(value: string) {
  return value ? `${Number(String(value).replace(/[^0-9]/g, "") || 0).toLocaleString("ko-KR")}원` : "";
}

function buildRow(
  kind: RequestKind,
  id: string,
  requestedAt: string,
  requester: string,
  values: RequestFormValues,
  totalAmount: string,
  requesterIdentity?: { salesName: string; team: string }
): RequestRow {
  const config = REQUEST_FORM_CONFIGS[kind];
  const base = {
    id,
    kind,
    type: config.title,
    companyName: values.companyName,
    requester,
    requesterSalesName: requesterIdentity?.salesName,
    requesterTeam: requesterIdentity?.team,
    requestedAt,
    status: "요청접수" as RequestStatus,
    result: "VIPS팀 접수 대기",
    contactEmail: values.contactEmail,
    note: values.note,
    processor: "-",
    processedAt: "-",
    assignedOwners: asStringArray(values.assignedOwners),
    attachments: buildAttachments(values)
  };

  if (kind === "advancePayment") {
    return {
      ...base,
      type: config.title,
      companyName: values.companyName || values.ikiTaxId,
      issueDate: "-",
      itemName: `${values.advanceUsageType || "선수금 처리"} · ${values.ikiTaxId}`,
      quantity: "-",
      unitPrice: "-",
      supplyAmount: values.gpAmount,
      totalAmount: money(values.gpAmount),
      details: {
        처리구분: values.advanceUsageType,
        "IKI Tax ID": values.ikiTaxId,
        선수금링크: values.advancePaymentLink,
        수금링크: values.advanceCollectionLink,
        PO링크: values.poLink,
        "G/P": money(values.gpAmount),
        "S/P": money(values.spAmount),
        "U/P": money(values.upAmount),
        비고: values.note
      }
    };
  }

  if (kind === "cardPayment") {
    return {
      ...base,
      issueDate: values.paymentDate,
      itemName: "카드 매출전표 확인",
      quantity: "-",
      unitPrice: "-",
      supplyAmount: values.paymentAmount,
      totalAmount: money(values.paymentAmount),
      details: {
        업체명: values.companyName,
        결제일자: values.paymentDate,
        결제금액: money(values.paymentAmount),
        "카드매출전표 업로드": values.cardReceiptName,
        비고: values.note
      }
    };
  }

  if (kind === "guaranteeInsurance") {
    return {
      ...base,
      issueDate: `${values.guaranteeStartDate} ~ ${values.guaranteeEndDate}`,
      itemName: values.contractName,
      quantity: "-",
      unitPrice: "-",
      supplyAmount: values.contractAmount,
      totalAmount: money(values.contractAmount),
      details: {
        "요청 구분": values.guaranteeRequestType,
        "보증보험 종류": values.guaranteeType,
        업체명: values.companyName,
        보증요율: values.guaranteeRate,
        보증기간: values.guaranteePeriod || `${values.guaranteeStartDate} ~ ${values.guaranteeEndDate}`,
        계약명: values.contractName,
        "계약금액(VAT 포함)": money(values.contractAmount),
        계약서첨부: values.contractFileName,
        첨부파일열기구조: "추후 파일 저장소/SharePoint 링크 연결 예정"
      }
    };
  }

  if (kind === "invoiceMatching") {
    const requestType = values.invoiceMatchType || "계산서매칭/해제";
    return {
      ...base,
      type: requestType,
      issueDate: "-",
      itemName: requestType,
      quantity: "-",
      unitPrice: "-",
      supplyAmount: "-",
      totalAmount: "-",
      details: {
        요청유형: requestType,
        업체명: values.companyName,
        계산서링크: values.invoiceLink,
        트래킹링크: values.trackingLink,
        요청사유: values.matchReason,
        비고: values.note
      }
    };
  }

  if (kind === "collectionMatching") {
    const requestType = values.collectionMatchType || "수금매칭/해제";
    return {
      ...base,
      type: requestType,
      issueDate: "-",
      itemName: requestType,
      quantity: "-",
      unitPrice: "-",
      supplyAmount: "-",
      totalAmount: "-",
      details: {
        요청유형: requestType,
        업체명: values.companyName,
        수금링크: values.collectionLink,
        트래킹URL: values.collectionTrackingUrl,
        세금계산서링크: values.collectionInvoiceLink,
        요청사유: values.matchReason,
        비고: values.note
      }
    };
  }

  if (kind === "revisedTaxInvoice") {
    return {
      ...base,
      companyName: "-",
      issueDate: "-",
      itemName: values.revisionRequestType,
      quantity: "-",
      unitPrice: "-",
      supplyAmount: "-",
      totalAmount: "-",
      details: {
        구분: values.revisionRequestType,
        기존세금계산서링크: values.originalInvoiceLink,
        수정사항: values.revisionChange,
        수정이유: values.revisionReason,
        비고: values.note
      }
    };
  }

  if (kind === "reverseIssueApproval") {
    return {
      ...base,
      issueDate: "-",
      itemName: "역발행 세금계산서 요청",
      quantity: values.reverseIssueCount,
      unitPrice: "-",
      supplyAmount: values.reverseFinalAmount,
      totalAmount: money(values.reverseFinalAmount),
      details: {
        역발행세금계산서사이트: values.reverseIssueSite,
        최종금액: money(values.reverseFinalAmount),
        건수: values.reverseIssueCount,
        비고: values.note
      }
    };
  }

  if (kind === "monthEndCheck") {
    return {
      ...base,
      issueDate: "-",
      itemName: values.monthEndCase,
      quantity: "-",
      unitPrice: "-",
      supplyAmount: "-",
      totalAmount: "-",
      details: {
        업체명: values.companyName,
        월마감확인유형: values.monthEndCase,
        월마감관련링크: values.monthEndLink,
        비고: values.note
      }
    };
  }

  return {
    ...base,
    issueDate: values.issueDate,
    itemName: values.itemName,
    quantity: values.quantity,
    unitPrice: values.unitPrice,
    supplyAmount: values.supplyAmount,
    totalAmount: values.invoiceTotalAmount || totalAmount,
    details: {
      업체명: values.companyName,
      "담당자(E메일)": values.contactEmail,
      발행일자: values.issueDate,
      품목명: values.itemName,
      수량: values.quantity,
      단가: money(values.unitPrice),
      공급가액: money(values.supplyAmount),
      부가세액: money(values.vatAmount),
      합계액: values.invoiceTotalAmount || totalAmount,
      "트래킹 매칭 여부": values.trackingMatchStatus,
      "트래킹 번호": values.trackingNumber,
      "트래킹 매칭 관련 메모": values.trackingMatchMemo,
      비고: values.note
    }
  };
}

export async function GET() {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  const rows = await readRows();
  const visibleRows = authUser ? rows.filter((row) => canViewRequestRow(row, authUser)) : rows;
  return NextResponse.json({ items: visibleRows.map(rowToItem) });
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  const payload = (await request.json()) as RequestCreatePayload;
  const rows = await readRows();
  const now = new Date();
  const requestedAt = formatRequestedAt(now);
  const id = createRequestId(now, rows.length);
  const requester = authUser?.email || payload.requester || payload.values.contactEmail;
  const row = buildRow(
    payload.kind,
    id,
    requestedAt,
    requester,
    payload.values,
    payload.totalAmount,
    authUser ? { salesName: authUser.salesName, team: authUser.team } : undefined
  );

  await writeRows([row, ...rows]);

  return NextResponse.json({
    item: rowToItem(row),
    storage: {
      type: "xlsx",
      path: xlsxPath
    }
  });
}

export async function PATCH(request: Request) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  const payload = (await request.json()) as RequestUpdatePayload;
  const rows = await readRows();
  const index = rows.findIndex((row) => row.id === payload.id);

  if (index === -1) {
    return NextResponse.json({ message: "Request not found" }, { status: 404 });
  }

  if (authUser && !isVipsUser(authUser) && !canViewRequestRow(rows[index], authUser)) {
    return NextResponse.json({ message: "이 요청을 변경할 권한이 없습니다." }, { status: 403 });
  }

  const now = new Date();
  const processedAt = formatRequestedAt(now);
  const current = rows[index];
  const isErpSend = payload.action === "erpSend";
  const erpTransmission = isErpSend ? buildMockErpTransmission(current, payload, processedAt) : current.erpTransmission;

  rows[index] = {
    ...current,
    status: isErpSend && erpTransmission?.status === "mock_sent" ? "완료" : payload.status,
    result: isErpSend
      ? erpTransmission?.status === "mock_sent"
        ? `${erpTransmission.system} 처리 승인 완료 (${erpTransmission.externalId})`
        : erpTransmission?.message ?? payload.result
      : payload.result,
    processor: payload.transmittedBy || "VIPS팀",
    processedAt,
    erpTransmission
  };

  await writeRows(rows);

  return NextResponse.json({
    item: rowToItem(rows[index]),
    storage: {
      type: "xlsx",
      path: xlsxPath
    }
  });
}

