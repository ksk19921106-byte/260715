import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { ClosingIssue, ClosingIssueType, ClosingSnapshot } from "../../services/closingPasteParser";
import { isSharedStorageConfigured, readSharedCollection, writeSharedCollection } from "../../services/sharedStorageServer";
import { isLiveAuthEnabled } from "../../services/authMode";
import { canViewSalesName, forbidden, getAuthenticatedPortalUser, isVipsUser, unauthorized } from "../../services/authServer";
import { PORTAL_USERS, type PortalUser } from "../../services/portalUsers";
import { canReviewMonthEnd, ownsMonthEndIssue, reviewVersion, transitionMonthEndReview, type ReviewAction } from "../../services/monthEndReview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

// Serialize read/modify/write within this server process so parallel row edits
// do not replace one another's snapshot. Stale row versions are rejected below.
let mutationQueue: Promise<unknown> = Promise.resolve();
function serializeMutation(action: () => Promise<NextResponse>) {
  const result = mutationQueue.then(action, action);
  mutationQueue = result.catch(() => undefined);
  return result;
}

const snapshotPath = path.join(process.cwd(), "data", "month-end-snapshot.json");
const historyPath = path.join(process.cwd(), "data", "month-end-snapshots.json");
const SHARED_CHUNK_SIZE = 30000;

type ChunkedSharedCollection = {
  v: 1;
  chunked: true;
  keys: string[];
  size: number;
  updatedAt: string;
};

type CompactClosingSnapshot = {
  v: 2;
  id: string;
  m: string;
  at: string;
  by: string;
  issues: CompactClosingIssue[];
};

type CompactClosingIssue = {
  r?: string;
  t?: string;
  f?: string;
  s?: string;
  c?: string;
  b?: number;
  g?: number;
  p?: number;
  y?: ClosingIssueType;
  a?: number;
  sd?: number;
  td?: number;
  st?: ClosingIssue["status"];
  m?: string;
  rv?: ClosingIssue["review"];
  e?: string;
  tr?: string;
  o?: string;
};

type HomeSummaryMetric = {
  count: number;
  amount: number;
};

type HomeSummaryBucket = Partial<Record<ClosingIssueType, HomeSummaryMetric>>;

type MonthEndHomeSummary = {
  id: string;
  closingMonth: string;
  uploadedAt: string;
  uploadedBy: string;
  total: HomeSummaryBucket;
  bySales: Record<string, HomeSummaryBucket>;
};

function scopeSnapshot(snapshot: ClosingSnapshot | null, user: PortalUser | null) {
  if (!snapshot || !user || isVipsUser(user)) return snapshot;
  return {
    ...snapshot,
    issues: snapshot.issues.filter((issue) => canViewSalesName(user, issue.iSales) || canViewSalesName(user, issue.fSales))
  };
}

function scopeSummary(summary: MonthEndHomeSummary | null, user: PortalUser | null) {
  if (!summary || !user || isVipsUser(user)) return summary;
  const bySales = Object.fromEntries(
    Object.entries(summary.bySales).filter(([salesName]) => canViewSalesName(user, salesName))
  );
  const total: HomeSummaryBucket = {};
  Object.values(bySales).forEach((bucket) => {
    Object.entries(bucket).forEach(([issueType, metric]) => {
      if (!metric) return;
      const key = issueType as ClosingIssueType;
      const current = total[key] ?? { count: 0, amount: 0 };
      total[key] = { count: current.count + metric.count, amount: current.amount + metric.amount };
    });
  });
  return { ...summary, total, bySales };
}

const issueMeta: Record<ClosingIssueType, { label: string; action: string }> = {
  invoice_required: {
    label: "출고O/계산서X",
    action: "고객사 출고는 완료되었지만 계산서가 미발행된 건입니다. 세금계산서 발행 요청이 필요합니다."
  },
  shipment_check: {
    label: "입고O/출고X/계산서O",
    action: "입고 및 계산서 발행은 완료되었지만 고객에게 출고되지 않은 건입니다. 출고 진행 여부를 확인해주세요."
  },
  long_pending: {
    label: "입고O/출고X/계산서X",
    action: "입고된 건이지만 고객에게 출고 및 계산서 발행이 진행되지 않은 건입니다. 거래 진행 상태를 먼저 확인해주세요."
  },
  collection_check: {
    label: "지연AR",
    action: "AR 지연 금액이 있습니다. 입금 확인 또는 수금관리 확인이 필요합니다."
  },
  deduct_check: {
    label: "Deduct 확인 필요",
    action: "Deduct 금액이 있습니다. Deduct 사유와 반영 여부를 확인해주세요."
  },
  sales_unshipped: {
    label: "세일즈 미출고",
    action: "세일즈 미출고 건입니다. 출고 처리 가능 여부와 보류 사유를 확인해주세요."
  }
};

function priorityFor(type: ClosingIssueType, amount: number, shipmentDays = 0, taxIssueDays = 0): ClosingIssue["priority"] {
  if ((type === "invoice_required" || type === "collection_check") && amount >= 1_000_000) return "high";
  if (taxIssueDays >= 14 || shipmentDays >= 14) return "high";
  if (amount > 0 || taxIssueDays >= 7 || shipmentDays >= 7) return "medium";
  return "low";
}

function compactSnapshot(snapshot: ClosingSnapshot): CompactClosingSnapshot {
  return {
    v: 2,
    id: snapshot.id,
    m: snapshot.closingMonth,
    at: snapshot.uploadedAt,
    by: snapshot.uploadedBy,
    issues: snapshot.issues.map((issue) => ({
      r: issue.sourceRowId,
      t: issue.team,
      f: issue.fSales,
      s: issue.iSales,
      c: issue.company,
      b: issue.billingAmount,
      g: issue.gpdAmount,
      p: issue.gpRate,
      y: issue.issueType,
      a: issue.amount,
      sd: issue.shipmentDays,
      td: issue.taxIssueDays,
      st: issue.status,
      m: issue.memo,
      rv: issue.review,
      e: issue.erpUrl,
      tr: issue.trackingUrl,
      o: issue.orderUrl
    }))
  };
}

function hydrateSnapshot(value: unknown): ClosingSnapshot | null {
  if (isValidSnapshot(value)) return { ...value, rawText: value.rawText ?? "" };

  if (!value || typeof value !== "object") return null;
  const compact = value as Partial<CompactClosingSnapshot>;
  if (compact.v !== 2 || !compact.id || !compact.at || !compact.by || !Array.isArray(compact.issues)) return null;

  const snapshotId = compact.id;
  const uploadedAt = compact.at;
  const uploadedBy = compact.by;
  const fallbackMonth = uploadedAt.slice(0, 7);
  const issues: ClosingIssue[] = compact.issues
    .filter((issue) => issue?.y && issueMeta[issue.y])
    .map((issue, index) => {
      const issueType = issue.y as ClosingIssueType;
      const shipmentDays = issue.sd;
      const taxIssueDays = issue.td;
      const amount = Number(issue.a ?? 0);
      const meta = issueMeta[issueType];
      return {
        id: `${uploadedAt}-${issue.r || index}-${issue.f || ""}-${issue.s || ""}-${issueType}`,
        sourceRowId: issue.r || `erp-row-${index + 1}`,
        team: String(issue.t || ""),
        fSales: String(issue.f || ""),
        iSales: String(issue.s || ""),
        company: String(issue.c || ""),
        billingAmount: issue.b,
        gpdAmount: issue.g,
        gpRate: issue.p,
        issueType,
        issueLabel: meta.label,
        amount,
        shipmentDays,
        taxIssueDays,
        priority: priorityFor(issueType, amount, Number(shipmentDays ?? 0), Number(taxIssueDays ?? 0)),
        recommendedAction: meta.action,
        uploadedAt,
        uploadedBy,
        status: issue.st || "open",
        memo: issue.m,
        review: issue.rv,
        erpUrl: issue.e,
        trackingUrl: issue.tr,
        orderUrl: issue.o
      };
    });

  return {
    id: snapshotId,
    closingMonth: String(compact.m || fallbackMonth),
    uploadedAt,
    uploadedBy,
    rawText: "",
    issues
  };
}

function hydrateSnapshotList(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value.map(hydrateSnapshot).filter((snapshot): snapshot is ClosingSnapshot => Boolean(snapshot));
}

function isChunkedSharedCollection(value: unknown): value is ChunkedSharedCollection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChunkedSharedCollection>;
  return candidate.v === 1 && candidate.chunked === true && Array.isArray(candidate.keys);
}

async function readChunkedSharedCollection<T>(collection: string) {
  const stored = await readSharedCollection<T | ChunkedSharedCollection>(collection);
  if (!isChunkedSharedCollection(stored)) return stored as T | null;

  const parts = await Promise.all(stored.keys.map((key) => readSharedCollection<string>(key)));
  if (parts.some((part) => typeof part !== "string")) return null;

  try {
    return JSON.parse(parts.join("")) as T;
  } catch {
    return null;
  }
}

async function writeChunkedSharedCollection<T>(collection: string, data: T) {
  const raw = JSON.stringify(data);
  if (raw.length <= SHARED_CHUNK_SIZE) {
    return writeSharedCollection(collection, data);
  }

  const keys: string[] = [];
  for (let offset = 0, index = 0; offset < raw.length; offset += SHARED_CHUNK_SIZE, index += 1) {
    const key = `${collection}__chunk_${index}`;
    const saved = await writeSharedCollection(key, raw.slice(offset, offset + SHARED_CHUNK_SIZE));
    if (!saved) return false;
    keys.push(key);
  }

  return writeSharedCollection(collection, {
    v: 1,
    chunked: true,
    keys,
    size: raw.length,
    updatedAt: new Date().toISOString()
  } satisfies ChunkedSharedCollection);
}

async function readSnapshotFile(requireShared = false) {
  const sharedSnapshot = hydrateSnapshot(await readChunkedSharedCollection<ClosingSnapshot | CompactClosingSnapshot>("monthEndSnapshot"));
  if (sharedSnapshot) return sharedSnapshot;
  if (requireShared && isSharedStorageConfigured()) return null;

  try {
    const raw = await readFile(snapshotPath, "utf8");
    return JSON.parse(raw) as ClosingSnapshot;
  } catch {
    return null;
  }
}

function snapshotMonth(snapshot: ClosingSnapshot) {
  const raw = String(snapshot.closingMonth || snapshot.uploadedAt || "");
  const match = raw.match(/(20\d{2})[-./년\s]*(0?[1-9]|1[0-2])/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

function latestSnapshot(snapshots: ClosingSnapshot[]) {
  return [...snapshots].sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))[0] ?? null;
}

function salesKey(value: string) {
  return String(value || "").trim().toLowerCase();
}

function addMetric(bucket: HomeSummaryBucket, issueType: ClosingIssueType, amount: number) {
  const current = bucket[issueType] ?? { count: 0, amount: 0 };
  bucket[issueType] = {
    count: current.count + 1,
    amount: current.amount + Number(amount || 0)
  };
}

function buildHomeSummary(snapshot: ClosingSnapshot): MonthEndHomeSummary {
  const total: HomeSummaryBucket = {};
  const bySales: Record<string, HomeSummaryBucket> = {};

  snapshot.issues
    .filter((issue) => issue.status === "open")
    .forEach((issue) => {
      addMetric(total, issue.issueType, issue.amount);
      [issue.iSales, issue.fSales].forEach((sales) => {
        const key = salesKey(sales);
        if (!key) return;
        bySales[key] ??= {};
        addMetric(bySales[key], issue.issueType, issue.amount);
      });
    });

  return {
    id: snapshot.id,
    closingMonth: snapshot.closingMonth,
    uploadedAt: snapshot.uploadedAt,
    uploadedBy: snapshot.uploadedBy,
    total,
    bySales
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readHomeSummary() {
  const sharedSummary = await readSharedCollection<MonthEndHomeSummary>("monthEndHomeSummary");
  if (sharedSummary?.id && sharedSummary.total && sharedSummary.bySales) return sharedSummary;

  // Home should read the compact summary. For old uploads that do not have it yet,
  // rebuild once from the latest snapshot, but never let Home wait indefinitely.
  const latest = await withTimeout(readSnapshotFile(), 6500, null);
  if (!latest) return null;
  const summary = buildHomeSummary(latest);
  await writeSharedCollection("monthEndHomeSummary", summary).catch(() => undefined);
  return summary;
}

async function writeHomeSummary(snapshot: ClosingSnapshot) {
  const summary = buildHomeSummary(snapshot);
  const saved = await writeSharedCollection("monthEndHomeSummary", summary);
  if (isSharedStorageConfigured() && !saved) throw new Error("Home summary save failed");
  return summary;
}

async function readHistoryFile() {
  const sharedHistory = hydrateSnapshotList(await readChunkedSharedCollection<ClosingSnapshot[] | CompactClosingSnapshot[]>("monthEndSnapshots"));
  if (sharedHistory) return sharedHistory;

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

async function writeHistoryFile(history: ClosingSnapshot[]) {
  const sharedSaved = await writeChunkedSharedCollection("monthEndSnapshots", history.map(compactSnapshot));
  if (isSharedStorageConfigured() && !sharedSaved) {
    throw new Error("month-end history shared storage save failed");
  }

  try {
    await mkdir(path.dirname(historyPath), { recursive: true });
    await writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

function isValidSnapshot(value: unknown): value is ClosingSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ClosingSnapshot>;
  return Boolean(snapshot.id && snapshot.uploadedAt && snapshot.uploadedBy && Array.isArray(snapshot.issues));
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  if (request.nextUrl.searchParams.get("summary") === "1") {
    return NextResponse.json({ summary: scopeSummary(await readHomeSummary(), authUser) });
  }

  if (request.nextUrl.searchParams.get("latest") === "1") {
    return NextResponse.json({ snapshot: scopeSnapshot(await readSnapshotFile(), authUser), history: [] });
  }

  const month = request.nextUrl.searchParams.get("month");
  const history = await readHistoryFile();
  const scopedHistory = month ? history.filter((snapshot) => snapshotMonth(snapshot) === month) : history;
  const snapshot = latestSnapshot(scopedHistory) ?? await readSnapshotFile();
  return NextResponse.json({
    snapshot: scopeSnapshot(snapshot, authUser),
    history: authUser ? scopedHistory.map((item) => scopeSnapshot(item, authUser)) : scopedHistory
  });
}

export function POST(request: NextRequest) {
  return serializeMutation(() => importSnapshot(request));
}

async function importSnapshot(request: NextRequest) {
  const authUser = await mutationViewer(request);
  if (!authUser) return unauthorized();
  if (!canReviewMonthEnd(authUser)) return forbidden("월마감 업로드는 VIPS팀만 할 수 있습니다. 사유 입력과 완료 요청은 개별 처리 기능을 이용해주세요.");
  const snapshot = await request.json();

  if (!isValidSnapshot(snapshot)) {
    return NextResponse.json({ message: "Invalid month-end snapshot" }, { status: 400 });
  }

  const current = await readSnapshotFile(true);
  const existing = new Map(current?.id === snapshot.id ? current.issues.map((issue) => [issue.id, issue]) : []);
  const snapshotToSave: ClosingSnapshot = { ...snapshot, issues: snapshot.issues.map((issue) => {
    const previous = existing.get(issue.id);
    return { ...issue, status: previous?.status || "open", memo: previous?.memo || issue.memo, review: previous?.review };
  }) };
  return persistSnapshot(snapshotToSave, authUser);
}

async function mutationViewer(request: NextRequest) {
  const user = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled()) return user;
  return PORTAL_USERS.find((person) => person.name === request.nextUrl.searchParams.get("viewer")) || null;
}

export function PATCH(request: NextRequest) {
  return serializeMutation(() => updateReview(request));
}

async function updateReview(request: NextRequest) {
  const user = await mutationViewer(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || !["memo", "submit", "approve", "reject"].includes(body.action) || typeof body.snapshotId !== "string" || typeof body.issueId !== "string" || typeof body.version !== "string" || typeof body.note !== "string" || body.note.length > 4000) {
    return NextResponse.json({ message: "변경 내용이 올바르지 않습니다." }, { status: 400 });
  }
  const current = await readSnapshotFile(true);
  if (!current) return NextResponse.json({ message: "최신 월마감 원본을 읽지 못했습니다. 저장소 연결을 확인해주세요." }, { status: 503 });
  if (current.id !== body.snapshotId) return NextResponse.json({ message: "월마감 원본이 변경되었습니다. 새로고침 후 다시 확인해주세요." }, { status: 409 });
  const issue = current.issues.find((item) => item.id === body.issueId);
  if (!issue) return NextResponse.json({ message: "해당 월마감 거래를 찾지 못했습니다." }, { status: 404 });
  if (!canReviewMonthEnd(user) && (!ownsMonthEndIssue(issue, user) || ["approve", "reject"].includes(body.action))) return forbidden("본인 건의 사유 입력·완료 요청만 가능합니다. 승인·반려는 VIPS팀 권한입니다.");
  if (reviewVersion(issue) !== body.version) return NextResponse.json({ message: "다른 사용자가 이 건을 변경했습니다. 새로고침 후 다시 확인해주세요." }, { status: 409 });
  try {
    const updated = transitionMonthEndReview(issue, user, body.action as ReviewAction, body.note, new Date().toISOString());
    return await persistSnapshot({ ...current, issues: current.issues.map((item) => item.id === issue.id ? updated : item) }, user);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "처리하지 못했습니다." }, { status: 400 });
  }
}

async function persistSnapshot(snapshotToSave: ClosingSnapshot, authUser: PortalUser) {
  if (process.env.VERCEL && !isSharedStorageConfigured()) return NextResponse.json({ message: "공용 저장소 URL을 설정해주세요." }, { status: 503 });

  const sharedSaved = await writeChunkedSharedCollection("monthEndSnapshot", compactSnapshot(snapshotToSave));
  if (isSharedStorageConfigured() && !sharedSaved) {
    return NextResponse.json(
      { message: "Google Sheets storage save failed. 월마감 데이터를 조각 저장하지 못했습니다. 저장소 URL/권한을 확인해주세요." },
      { status: 502 }
    );
  }

  const history = await readHistoryFile();
  const nextHistory = [snapshotToSave, ...history.filter((item) => item.id !== snapshotToSave.id)];
  try {
    await writeHistoryFile(nextHistory);
  } catch {
    if (isSharedStorageConfigured()) {
      return NextResponse.json(
        { message: "Google Sheets history save failed. 월별 누적 저장 공간을 확인해야 합니다." },
        { status: 502 }
      );
    }
  }

  try {
    await writeHomeSummary(snapshotToSave);
  } catch {
    return NextResponse.json({ message: "월마감 원본은 저장되었지만 HOME 요약 갱신에 실패했습니다. 새로고침 후 반영 상태를 확인해주세요." }, { status: 502 });
  }

  try {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, JSON.stringify(snapshotToSave, null, 2), "utf8");
  } catch {
    if (!isSharedStorageConfigured()) return NextResponse.json({ message: "월마감 데이터를 저장하지 못했습니다." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, snapshot: scopeSnapshot(snapshotToSave, authUser) });
}

