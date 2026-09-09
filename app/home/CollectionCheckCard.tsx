"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, WalletCards, X } from "lucide-react";
import { useSelectedUser } from "../hooks/useSelectedUser";
import { buildCollectionIssues, buildCollectionSummary, extractReceivableAssignee, filterReceivablesByUser, formatKrwShort, normalizeSalesName, normalizeTeamName, type ReceivableRecord } from "../services/receivables";

const ACTION_STATUS_KEY = "icbanq.ops.collectionActionStatus";

type CollectionCardKey = "total" | "unpaid";
type CollectionCardItem = {
  key: CollectionCardKey;
  label: string;
  count: string;
  sub: string;
  icon: typeof WalletCards;
  status: string;
  records: ReceivableRecord[];
};
export type HomeCollectionTask = {
  id: string;
  source: "collection";
  label: string;
  count: number;
  amount: string;
  description: string;
  openKey: string;
};

type LiveReceivableRecord = {
  [key: string]: unknown;
  id?: string;
  team?: string;
  sales?: string;
  fSales?: string;
  name?: string;
  company?: string;
  expected?: number;
  expectedAmount?: number;
  paid?: number;
  paidAmount?: number;
  diff?: number;
  unpaidAmount?: number;
  rate?: number;
  status?: string;
  gubun?: string;
  basis?: string;
  matched_payer?: string;
  matchedPayer?: string;
  collectionMonth?: string;
  month?: string;
  dueDate?: string;
  expectedDate?: string;
  date?: string;
  overdueDays?: number;
  agingBucket?: string;
  erpUrl?: string;
  trackingUrl?: string;
  orderUrl?: string;
  poUrl?: string;
  link?: string;
};

const RECEIVABLE_STATUS_KEY = "icbanq.ops.receivableStatusRecords";

function hasCount(value: string) {
  return Number(value.replace(/[^0-9]/g, "")) > 0;
}

function formatDuration(record: ReceivableRecord) {
  if (record.overdueDays <= 0) return "소요 0일";
  return record.status === "완료" ? `소요 ${record.overdueDays}일` : `지연 ${record.overdueDays}일`;
}

function normalizeCollectionStatus(value?: string | null): ReceivableRecord["status"] {
  const text = String(value ?? "").trim();
  if (text.includes("부분")) return "부분수금";
  if (text.includes("미수")) return "미수";
  if (text.includes("완료") || text.includes("취소")) return "완료";
  return "미수";
}

function normalizeCollectionStatusByAmounts(value: string | undefined, expected: number, paid: number, diff: number): ReceivableRecord["status"] {
  const explicit = normalizeCollectionStatus(value);
  if (value && explicit !== "미수") return explicit;
  if (expected > 0 && diff <= 0) return "완료";
  if (expected > 0 && paid > 0 && diff > 0) return "부분수금";
  return explicit;
}

function normalizeCollectionMonth(value?: string | number | null) {
  const raw = String(value ?? "").trim();
  const iso = raw.match(/(20\d{2})[-./년\s]*(0?[1-9]|1[0-2])/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}`;
  const short = raw.match(/(0?[1-9]|1[0-2])\s*월/);
  if (short) return `${new Date().getFullYear()}-${String(Number(short[1])).padStart(2, "0")}`;
  return "";
}

function normalizeAgingBucket(value: unknown, overdueDays: number) {
  const raw = String(value ?? "").trim();
  if (raw && raw !== "-") return raw;
  if (overdueDays > 30) return "30일초과";
  if (overdueDays > 21) return "30일이내";
  if (overdueDays > 14) return "21일이내";
  if (overdueDays > 7) return "14일이내";
  return "7일이내";
}

function normalizeLiveReceivableRecord(record: LiveReceivableRecord, index: number): ReceivableRecord | null {
  const name = String(record.name ?? record.company ?? "").trim();
  if (!name) return null;
  const assignee = extractReceivableAssignee(record);
  const expected = Number(record.expected ?? record.expectedAmount ?? 0);
  const explicitPaid = Number(record.paid ?? record.paidAmount ?? 0);
  const explicitDiff = Number(record.diff ?? record.unpaidAmount ?? NaN);
  const provisionalStatus = normalizeCollectionStatus(record.status);
  const diff = Number.isFinite(explicitDiff)
    ? Math.max(0, explicitDiff)
    : provisionalStatus === "완료"
      ? 0
      : Math.max(0, expected - explicitPaid);
  const paid = explicitPaid || Math.max(0, expected - diff);
  const overdueDays = Number(record.overdueDays ?? 0);

  return {
    id: String(record.id ?? `home-live-${index}`),
    team: normalizeTeamName(record.team ?? assignee.sales),
    fSales: assignee.fSales || undefined,
    sales: assignee.sales,
    name,
    expected,
    paid,
    diff,
    rate: Number(record.rate ?? (expected > 0 ? Math.round((paid / expected) * 1000) / 10 : 0)),
    status: normalizeCollectionStatusByAmounts(record.status, expected, paid, diff),
    gubun: record.gubun,
    basis: record.basis ?? "수금현황 웹앱 연동",
    matched_payer: record.matched_payer ?? record.matchedPayer,
    collectionMonth: normalizeCollectionMonth(record.collectionMonth ?? record.month ?? record.dueDate ?? record.expectedDate ?? record.date),
    dueDate: String(record.dueDate ?? record.expectedDate ?? record.date ?? ""),
    overdueDays,
    agingBucket: normalizeAgingBucket(record.agingBucket, overdueDays),
    erpUrl: record.erpUrl,
    trackingUrl: record.trackingUrl,
    orderUrl: record.orderUrl,
    poUrl: record.poUrl,
    link: record.link
  };
}

function extractLiveReceivableRecords(payload: unknown): ReceivableRecord[] {
  const root = payload as {
    payload?: unknown;
    records?: LiveReceivableRecord[];
    data?: { records?: LiveReceivableRecord[] };
  };
  const body = (root?.payload ?? root) as {
    records?: LiveReceivableRecord[];
    data?: { records?: LiveReceivableRecord[] };
  };
  const records = Array.isArray(body.records) ? body.records : body.data?.records;
  if (!Array.isArray(records)) return [];
  return records
    .map((record, index) => normalizeLiveReceivableRecord(record, index))
    .filter((record): record is ReceivableRecord => Boolean(record && record.expected > 0));
}

function recordHref(record: ReceivableRecord) {
  return record.erpUrl || record.trackingUrl || record.orderUrl || record.poUrl || record.link || "";
}

function HomeRowLink({ href }: { href?: string }) {
  if (!href) {
    return (
      <span className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-full bg-[#f8fafc] px-3 text-[11px] font-[950] text-[#94a3b8]">
        준비중
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-full bg-[#edf4ff] px-3 text-[11px] font-[950] text-[#1D50A2] transition hover:bg-[#dbeafe]"
    >
      바로가기
    </a>
  );
}

function CollectionIssueModal({
  item,
  onClose
}: {
  item: CollectionCardItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111827]/45 px-4 py-6">
      <section className="w-full max-w-[900px] overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <div>
            <h3 className="text-[20px] font-[950] tracking-[-0.03em] text-[#111827]">
              {item.label} · {item.records.length}건
            </h3>
            <p className="mt-1 text-[12px] font-[750] text-[#64748b]">HOME에서 바로 확인하는 AR 리스트입니다.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e9eef6] bg-white text-[#64748b] transition hover:bg-[#f8fafc]">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-auto px-6 py-5">
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
            <thead className="text-[12px] font-[900] text-[#64748b]">
              <tr>
                <th className="border-b border-[#e5e7eb] px-3 py-2">부서명</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">Sales</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">업체명</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">AR (VAT포함)</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">상태</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">지연/소요 기간</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">바로가기</th>
              </tr>
            </thead>
            <tbody className="text-[13px] font-[750] text-[#111827]">
              {item.records.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[#94a3b8]">조건에 맞는 AR 데이터가 없습니다.</td></tr>
              ) : (
                item.records.map((record) => (
                  <tr key={record.id}>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{record.team || "-"}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3 font-[950]">{normalizeSalesName(record.sales) || "미매칭"}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{record.name}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{formatKrwShort(record.diff > 0 ? record.diff : record.expected)}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{record.status}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{formatDuration(record)}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">
                      <HomeRowLink href={recordHref(record)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function CollectionCheckCard({
  onTaskCountChange,
  onTaskItemsChange
}: {
  onTaskCountChange?: (count: number) => void;
  onTaskItemsChange?: (items: HomeCollectionTask[]) => void;
}) {
  const { selectedUser } = useSelectedUser();
  const [checkedIssueIds, setCheckedIssueIds] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<CollectionCardItem | null>(null);
  const [sourceRecords, setSourceRecords] = useState<ReceivableRecord[]>([]);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = window.localStorage.getItem(ACTION_STATUS_KEY);
        const statuses = raw ? (JSON.parse(raw) as Record<string, { status?: string }>) : {};
        setCheckedIssueIds(Object.entries(statuses).filter(([, value]) => value.status === "checked").map(([key]) => key));
      } catch {
        setCheckedIssueIds([]);
      }
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("icbanq:collection-action-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("icbanq:collection-action-change", sync);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECEIVABLE_STATUS_KEY);
      if (raw) setSourceRecords(JSON.parse(raw) as ReceivableRecord[]);
    } catch {
      setSourceRecords([]);
    }

    void fetch("/api/receivables-status?latest=1", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const records = payload?.snapshot?.records;
        if (!Array.isArray(records) || records.length === 0) return;
        setSourceRecords(records as ReceivableRecord[]);
        try {
          window.localStorage.setItem(RECEIVABLE_STATUS_KEY, JSON.stringify(records));
        } catch {
          // Shared data still renders even when browser storage is unavailable.
        }
      })
      .catch(() => undefined);

    void fetch("/api/receivables-live", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const records = extractLiveReceivableRecords(payload);
        if (records.length === 0) return;
        setSourceRecords(records);
        try {
          window.localStorage.setItem(RECEIVABLE_STATUS_KEY, JSON.stringify(records));
        } catch {
          // Live data still renders even when browser storage is unavailable.
        }
      })
      .catch(() => undefined);
  }, []);

  const visibleRecords = filterReceivablesByUser(sourceRecords, selectedUser);
  const summary = buildCollectionSummary(visibleRecords);
  const issues = buildCollectionIssues(visibleRecords).filter((issue) => !checkedIssueIds.includes(issue.id));
  const unpaidRecords = visibleRecords.filter((record) => record.status === "미수" && record.diff > 0);
  const unpaidAmount = unpaidRecords.reduce((sum, record) => sum + record.diff, 0);
  const taskCount = unpaidRecords.length > 0 ? 1 : 0;
  const unpaidRatio = summary.expected > 0 ? Math.round((unpaidAmount / summary.expected) * 100) : 0;
  const collectionItems: CollectionCardItem[] = useMemo(
    () => [
      { key: "total", label: "전체 금액 및 건수", count: formatKrwShort(summary.expected), sub: `${visibleRecords.length}건`, icon: WalletCards, status: "info", records: visibleRecords },
      { key: "unpaid", label: "미수 금액 및 건수", count: formatKrwShort(unpaidAmount), sub: `${unpaidRecords.length}건 · 전체 대비 ${unpaidRatio}%`, icon: Banknote, status: "needCheck", records: unpaidRecords }
    ],
    [summary.expected, unpaidAmount, unpaidRatio, unpaidRecords, visibleRecords]
  );
  const taskItems: HomeCollectionTask[] = useMemo(
    () =>
      collectionItems
        .filter((item) => item.key !== "total")
        .map((item) => ({
          id: `collection-${item.key}`,
          source: "collection" as const,
          label: item.label,
          count: item.records.length,
          amount: item.count,
          description: item.key === "unpaid" ? "아직 수금 완료되지 않은 거래입니다." : "입금/거래 연결 확인이 필요한 건입니다.",
          openKey: item.key
        }))
        .filter((item) => item.count > 0),
    [collectionItems]
  );

  useEffect(() => {
    onTaskCountChange?.(taskCount);
  }, [onTaskCountChange, taskCount]);

  useEffect(() => {
    onTaskItemsChange?.(taskItems);
  }, [onTaskItemsChange, taskItems]);

  useEffect(() => {
    const openCollectionItem = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      const item = collectionItems.find((entry) => entry.key === key);
      if (item) setSelectedItem(item);
    };
    window.addEventListener("icbanq:home-open-collection-task", openCollectionItem);
    return () => window.removeEventListener("icbanq:home-open-collection-task", openCollectionItem);
  }, [collectionItems]);

  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-[950] tracking-[-0.02em] text-[#111827]">AR 체크</h2>
          <p className="mt-1 truncate text-[12px] font-[750] text-[#64748b]">전월말 수금 현황을 확인합니다.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#F39945]">{taskCount.toLocaleString("ko-KR")}건</span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-2.5 min-[1180px]:grid-cols-3">
        {collectionItems.map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => setSelectedItem(item)}
            className={`flex h-[128px] min-w-0 flex-col justify-center overflow-hidden rounded-[16px] border bg-[#fbfcff] px-3.5 py-3 text-left shadow-[0_4px_10px_rgba(15,23,42,0.022)] transition hover:border-[#1D50A2] hover:bg-white ${
              hasCount(item.count) ? "border-[#cbd5e1] ring-1 ring-[#e2e8f0]" : "border-[#edf2f8]"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
              <item.icon size={15} />
            </span>
            <p className="mt-1.5 truncate text-[11px] font-[800] leading-[1.2] text-[#475569]">{item.label}</p>
            <p className={`mt-0.5 truncate text-[18px] font-[900] leading-none tracking-[-0.02em] ${item.status === "needCheck" ? "text-[#F39945]" : "text-[#111827]"}`}>
              {item.count}
            </p>
            <p className="mt-1 truncate text-[9.5px] font-[650] leading-none text-[#64748b]">{item.sub}</p>
          </button>
        ))}
      </div>

      <button onClick={() => (window.location.href = "/collections")} className="mt-4 h-[44px] w-full rounded-[14px] border border-[#e9eef6] bg-[#f8fbff] text-[13px] font-[950] text-[#1D50A2] shadow-[0_4px_10px_rgba(15,23,42,0.025)] transition hover:bg-[#edf4ff]">
        수금관리 바로가기
      </button>
      <CollectionIssueModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </section>
  );
}
