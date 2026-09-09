import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { ReceivableRecord } from "../../services/receivables";
import { readSharedCollection, writeSharedCollection } from "../../services/sharedStorageServer";
import { isLiveAuthEnabled } from "../../services/authMode";
import { canViewSalesName, forbidden, getAuthenticatedPortalUser, isVipsUser, unauthorized } from "../../services/authServer";
import type { PortalUser } from "../../services/portalUsers";

export const runtime = "nodejs";

type ReceivablesStatusSnapshot = {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
  collectionMonth?: string;
  sourceType?: "paste" | "file";
  records: ReceivableRecord[];
};

const snapshotPath = path.join(process.cwd(), "data", "receivables-status.json");
const historyPath = path.join(process.cwd(), "data", "receivables-status-history.json");

function scopeSnapshot(snapshot: ReceivablesStatusSnapshot | null, user: PortalUser | null) {
  if (!snapshot || !user || isVipsUser(user)) return snapshot;
  return { ...snapshot, records: snapshot.records.filter((record) => canViewSalesName(user, record.sales) || canViewSalesName(user, record.fSales)) };
}

function isValidSnapshot(value: unknown): value is ReceivablesStatusSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ReceivablesStatusSnapshot>;
  return Boolean(snapshot.id && snapshot.uploadedAt && snapshot.uploadedBy && Array.isArray(snapshot.records));
}

async function readSnapshotFile() {
  const sharedSnapshot = await readSharedCollection<ReceivablesStatusSnapshot>("receivablesStatus");
  if (isValidSnapshot(sharedSnapshot)) return sharedSnapshot;

  try {
    const raw = await readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(raw);
    return isValidSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

function snapshotMonth(snapshot: ReceivablesStatusSnapshot) {
  const explicit = snapshot.collectionMonth || snapshot.records.map((record) => record.collectionMonth || record.dueDate || "").find(Boolean);
  const raw = String(explicit || snapshot.uploadedAt || "");
  const match = raw.match(/(20\d{2})\D*(0?[1-9]|1[0-2])/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

function latestSnapshot(snapshots: ReceivablesStatusSnapshot[]) {
  return [...snapshots].sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))[0] ?? null;
}

async function readHistoryFile() {
  const sharedHistory = await readSharedCollection<ReceivablesStatusSnapshot[]>("receivablesStatusHistory");
  if (Array.isArray(sharedHistory)) return sharedHistory.filter(isValidSnapshot);

  try {
    const raw = await readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isValidSnapshot);
  } catch {
    // Fall back to the legacy latest snapshot below.
  }

  const latest = await readSnapshotFile();
  return latest ? [latest] : [];
}

async function writeHistoryFile(history: ReceivablesStatusSnapshot[]) {
  await writeSharedCollection("receivablesStatusHistory", history);

  try {
    await mkdir(path.dirname(historyPath), { recursive: true });
    await writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

async function writeSnapshotFile(snapshot: ReceivablesStatusSnapshot) {
  await writeSharedCollection("receivablesStatus", snapshot);

  try {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  if (request.nextUrl.searchParams.get("latest") === "1") {
    return NextResponse.json({ snapshot: scopeSnapshot(await readSnapshotFile(), authUser), history: [] });
  }

  const month = request.nextUrl.searchParams.get("month");
  const history = await readHistoryFile();
  const scopedHistory = month ? history.filter((snapshot) => snapshotMonth(snapshot) === month) : history;
  const snapshot = latestSnapshot(scopedHistory) ?? await readSnapshotFile();
  return NextResponse.json({ snapshot: scopeSnapshot(snapshot, authUser), history: authUser ? history.map((item) => scopeSnapshot(item, authUser)) : history });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  if (authUser && !isVipsUser(authUser)) return forbidden("수금 원본 데이터는 VIPS만 업로드할 수 있습니다.");
  const snapshot = await request.json();

  if (!isValidSnapshot(snapshot)) {
    return NextResponse.json({ message: "Invalid receivables status snapshot" }, { status: 400 });
  }

  await writeSnapshotFile(snapshot);
  const history = await readHistoryFile();
  await writeHistoryFile([snapshot, ...history.filter((item) => item.id !== snapshot.id)]);
  return NextResponse.json({ ok: true, snapshot });
}
