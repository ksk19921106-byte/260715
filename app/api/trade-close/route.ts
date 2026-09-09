import { inflateRawSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isLiveAuthEnabled } from "../../services/authMode";
import { canViewSalesName, forbidden, getAuthenticatedPortalUser, isVipsUser, unauthorized } from "../../services/authServer";
import {
  buildTradeCloseSummary,
  getTradeCloseSummaryForUser,
  type TradeCloseRecord
} from "../../services/tradeClose";

export const runtime = "nodejs";

const dataPath = path.join(process.cwd(), "data", "trade-close-records.json");

const headerAliases: Record<string, string[]> = {
  salesOwner: ["담당 SALES", "담당SALES", "SALES", "담당자", "영업", "salesOwner"],
  customerName: ["거래처명", "업체명", "고객명", "customerName"],
  orderNo: ["거래/주문번호", "거래번호", "주문번호", "오더번호", "orderNo"],
  received: ["입고 여부", "입고", "received"],
  shipped: ["출고 여부", "출고", "shipped"],
  taxInvoiceIssued: ["세금계산서 발행 여부", "세금계산서", "계산서", "계산서 발행", "taxInvoiceIssued"],
  collected: ["수금 여부", "수금", "collected"],
  matched: ["매칭 여부", "매칭", "matched"],
  incompleteType: ["미완료 유형", "미종료 유형", "미완료유형", "미종료유형", "incompleteType"]
};

async function readRecords(): Promise<TradeCloseRecord[]> {
  try {
    return JSON.parse(await readFile(dataPath, "utf8")) as TradeCloseRecord[];
  } catch {
    return [];
  }
}

async function writeRecords(records: TradeCloseRecord[]) {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(records, null, 2), "utf8");
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asBool(value: unknown) {
  const text = asText(value).toLowerCase();
  return ["o", "y", "yes", "true", "1", "완료", "발행", "수금", "매칭", "입고", "출고", "ok"].includes(text);
}

function pick(row: Record<string, string>, key: keyof typeof headerAliases) {
  const aliases = headerAliases[key];
  const found = aliases.find((alias) => row[alias] !== undefined);
  return found ? row[found] : "";
}

function normalizeRecord(row: Record<string, string>, index: number, uploadedAt: string): TradeCloseRecord {
  return {
    id: `TC-${Date.now()}-${String(index + 1).padStart(3, "0")}`,
    salesOwner: pick(row, "salesOwner") || "미지정",
    customerName: pick(row, "customerName") || "-",
    orderNo: pick(row, "orderNo") || "-",
    received: asBool(pick(row, "received")),
    shipped: asBool(pick(row, "shipped")),
    taxInvoiceIssued: asBool(pick(row, "taxInvoiceIssued")),
    collected: asBool(pick(row, "collected")),
    matched: asBool(pick(row, "matched")),
    incompleteType: pick(row, "incompleteType"),
    uploadedAt
  };
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
    .filter((row) => row.some(Boolean))
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

function parseSheet(xml: string, sharedStrings: string[]) {
  return Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)).map((rowMatch) =>
    Array.from(rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)).map((cellMatch) => {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const inline = body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      if (attrs.includes('t="s"')) return sharedStrings[Number(value)] ?? "";
      return xmlDecode(inline ?? value);
    })
  );
}

function parseXlsx(buffer: Buffer) {
  const files = unzip(buffer);
  const sheet = files.get("xl/worksheets/sheet1.xml");
  if (!sheet) return [];
  const sharedStringsXml = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  return rowsToObjects(parseSheet(sheet.toString("utf8"), sharedStrings));
}

export async function GET(request: Request) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  const url = new URL(request.url);
  const requestedUser = url.searchParams.get("user");
  if (authUser && requestedUser && !canViewSalesName(authUser, requestedUser)) return forbidden();
  const user = authUser && !requestedUser && !isVipsUser(authUser) ? authUser.salesName : requestedUser;
  const dashboard = buildTradeCloseSummary(await readRecords());
  const visibleUsers = authUser && !isVipsUser(authUser)
    ? dashboard.users.filter((item) => canViewSalesName(authUser, item.salesOwner))
    : dashboard.users;
  const visibleDashboard = {
    ...dashboard,
    users: visibleUsers,
    totalRecords: visibleUsers.reduce((sum, item) => sum + item.records.length, 0),
    totalUnresolved: visibleUsers.reduce((sum, item) => sum + item.unresolvedCount, 0)
  };

  return NextResponse.json({
    ...visibleDashboard,
    currentUser: user ? getTradeCloseSummaryForUser(visibleDashboard, user) : undefined
  });
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  if (authUser && !isVipsUser(authUser)) return forbidden("거래 종료 원본 데이터는 VIPS만 업로드할 수 있습니다.");
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "업로드할 파일이 없습니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();
  const rows = lowerName.endsWith(".xlsx") ? parseXlsx(buffer) : parseCsv(buffer.toString("utf8"));
  const uploadedAt = new Date().toISOString();
  const records = rows.map((row, index) => normalizeRecord(row, index, uploadedAt));

  await writeRecords(records);

  return NextResponse.json(buildTradeCloseSummary(records));
}

