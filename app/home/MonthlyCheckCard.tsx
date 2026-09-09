"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useSelectedUser } from "../hooks/useSelectedUser";
import type { ClosingIssue, ClosingSnapshot, ClosingIssueType } from "../services/closingPasteParser";
import { fetchMonthEndRmaSnapshot, type MonthEndRmaRecord, type MonthEndRmaSnapshot } from "../services/monthEndRma";
import { monthlyItems } from "./homeData";

type MonthlyItemKey = "invoice_required" | "shipment_check" | "long_pending" | "rma";
type SelectedMonthlyItem = (typeof monthlyItems)[number];
type HomeSummaryMetric = {
  count: number;
  amount: number;
};
type MonthEndHomeSummary = {
  id: string;
  closingMonth: string;
  uploadedAt: string;
  uploadedBy: string;
  total: Partial<Record<ClosingIssueType, HomeSummaryMetric>>;
  bySales: Record<string, Partial<Record<ClosingIssueType, HomeSummaryMetric>>>;
};
export type HomeMonthlyTask = {
  id: string;
  source: "monthEnd";
  label: string;
  count: number;
  amount: string;
  description: string;
  openKey: string;
};

const monthlyDescriptions: Record<string, string> = {
  invoice_required: "출고는 완료됐지만 세금계산서가 아직 발행되지 않은 건입니다.",
  shipment_check: "입고 또는 계산서는 되었지만 고객 출고가 완료되지 않은 건입니다.",
  long_pending: "입고 후 출고와 계산서 발행이 모두 남아 있는 건입니다.",
  rma: "RMA 처리 상태를 Sales가 확인해야 하는 건입니다."
};

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function hasCount(value: string) {
  return Number(value.replace(/[^0-9]/g, "")) > 0;
}

function issueMatchesUser(issue: ClosingIssue, userName: string, isAdmin: boolean) {
  if (isAdmin) return true;
  return issue.iSales === userName || issue.fSales === userName;
}

function rmaMatchesUser(record: MonthEndRmaRecord, userName: string, isAdmin: boolean) {
  if (isAdmin) return true;
  return record.sales === userName;
}

function salesKey(value: string) {
  return String(value || "").trim().toLowerCase();
}

function titleForKey(key: MonthlyItemKey) {
  return monthlyItems.find((item) => item.key === key)?.label ?? "월마감 이슈";
}

function issueHref(issue: ClosingIssue) {
  return issue.erpUrl || issue.trackingUrl || issue.orderUrl || "";
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

function MonthlyIssueModal({
  item,
  issues,
  rmaRecords,
  onClose
}: {
  item: SelectedMonthlyItem | null;
  issues: ClosingIssue[];
  rmaRecords: MonthEndRmaRecord[];
  onClose: () => void;
}) {
  if (!item) return null;
  const key = item.key as MonthlyItemKey;
  const isRma = key === "rma";
  const totalCount = isRma ? rmaRecords.length : issues.length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111827]/45 px-4 py-6">
      <section className="w-full max-w-[900px] overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <div>
            <h3 className="text-[20px] font-[950] tracking-[-0.03em] text-[#111827]">
              {titleForKey(key)} · {totalCount}건
            </h3>
            <p className="mt-1 text-[12px] font-[750] text-[#64748b]">HOME에서 전체 Sales 기준으로 빠르게 확인하는 월마감 리스트입니다.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e9eef6] bg-white text-[#64748b] transition hover:bg-[#f8fafc]">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-auto px-6 py-5">
          {isRma ? (
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
              <thead className="text-[12px] font-[900] text-[#64748b]">
                <tr>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">Sales</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">업체명</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">P.status</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">W.status</th>
                </tr>
              </thead>
              <tbody className="text-[13px] font-[750] text-[#111827]">
                {rmaRecords.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-10 text-center text-[#94a3b8]">표시할 RMA 미처리 내역이 없습니다.</td></tr>
                ) : (
                  rmaRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="border-b border-[#edf2f8] px-3 py-3 font-[950]">{record.sales}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{record.supplier}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{record.purchaseStatus || "-"}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{record.warehouseStatus || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
              <thead className="text-[12px] font-[900] text-[#64748b]">
                <tr>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">부서명</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">Sales</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">업체명</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">Billing</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">GPD</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">GP</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">미발행/미출고 기간</th>
                  <th className="border-b border-[#e5e7eb] px-3 py-2">바로가기</th>
                </tr>
              </thead>
              <tbody className="text-[13px] font-[750] text-[#111827]">
                {issues.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-[#94a3b8]">조건에 맞는 월마감 이슈가 없습니다.</td></tr>
                ) : (
                  issues.map((issue) => (
                    <tr key={issue.id}>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{issue.team || "-"}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3 font-[950]">{issue.iSales || issue.fSales || "-"}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{issue.company}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{formatWon(issue.amount)}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{formatWon(issue.gpdAmount ?? 0)}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{issue.gpRate != null ? `${issue.gpRate}%` : "-"}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">{issue.issueType === "invoice_required" ? `${issue.taxIssueDays ?? 0}일` : `${issue.shipmentDays ?? 0}일`}</td>
                      <td className="border-b border-[#edf2f8] px-3 py-3">
                        <HomeRowLink href={issueHref(issue)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export function MonthlyCheckCard({
  onTaskCountChange,
  onTaskItemsChange
}: {
  onTaskCountChange?: (count: number) => void;
  onTaskItemsChange?: (items: HomeMonthlyTask[]) => void;
}) {
  const { selectedUser } = useSelectedUser();
  const [snapshot, setSnapshot] = useState<ClosingSnapshot | null>(null);
  const [homeSummary, setHomeSummary] = useState<MonthEndHomeSummary | null>(null);
  const [rmaSnapshot, setRmaSnapshot] = useState<MonthEndRmaSnapshot | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedMonthlyItem | null>(null);
  const isAdmin = selectedUser.accessRole === "admin";

  useEffect(() => {
    fetch("/api/month-end-snapshot?summary=1", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { summary?: MonthEndHomeSummary | null } | null) => setHomeSummary(data?.summary ?? null))
      .catch(() => setHomeSummary(null));
    fetchMonthEndRmaSnapshot()
      .then(setRmaSnapshot)
      .catch(() => setRmaSnapshot(null));
  }, []);

  const loadSnapshot = async () => {
    if (snapshot) return snapshot;
    const response = await fetch("/api/month-end-snapshot", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { snapshot?: ClosingSnapshot | null };
    setSnapshot(data.snapshot ?? null);
    return data.snapshot ?? null;
  };

  const openItem = async (item: SelectedMonthlyItem) => {
    setSelectedItem(item);
    if (item.key !== "rma") {
      await loadSnapshot();
    }
  };

  const scopedIssues = useMemo(
    () => (snapshot?.issues ?? []).filter((issue) => issue.status === "open" && issueMatchesUser(issue, selectedUser.salesName, isAdmin)),
    [isAdmin, selectedUser.salesName, snapshot]
  );
  const scopedRmaRecords = useMemo(
    () => (rmaSnapshot?.records ?? []).filter((record) => rmaMatchesUser(record, selectedUser.salesName, isAdmin)),
    [isAdmin, rmaSnapshot, selectedUser.salesName]
  );

  const getIssuesForItem = (item: SelectedMonthlyItem | null) => {
    if (!item || item.key === "rma") return [];
    return scopedIssues.filter((issue) => issue.issueType === item.key as ClosingIssueType);
  };

  const displayItems = useMemo(
    () =>
      monthlyItems.map((item) => {
        if (item.key === "rma") {
          return {
            ...item,
            count: `${scopedRmaRecords.length}건`,
            amount: scopedRmaRecords.length > 0 ? item.amount : "0원"
          };
        }
        const summaryBucket = isAdmin ? homeSummary?.total : homeSummary?.bySales?.[salesKey(selectedUser.salesName)];
        const summaryMetric = summaryBucket?.[item.key as ClosingIssueType];
        if (summaryMetric) {
          return {
            ...item,
            count: `${summaryMetric.count}건`,
            amount: item.key === "long_pending" ? "상태: 입고 완료" : formatWon(summaryMetric.amount)
          };
        }
        const issues = scopedIssues.filter((issue) => issue.issueType === item.key as ClosingIssueType);
        if (issues.length === 0) return { ...item, count: "0건", amount: "0원" };
        return {
          ...item,
          count: `${issues.length}건`,
          amount: item.key === "long_pending" ? "상태: 입고 완료" : formatWon(issues.reduce((sum, issue) => sum + issue.amount, 0))
        };
      }),
    [homeSummary, isAdmin, scopedIssues, scopedRmaRecords.length, selectedUser.salesName]
  );
  const taskCount = useMemo(() => displayItems.filter((item) => Number(item.count.replace(/[^0-9]/g, "")) > 0).length, [displayItems]);
  const taskItems = useMemo(
    () =>
      displayItems
        .map((item) => ({
          id: `month-${item.key}`,
          source: "monthEnd" as const,
          label: item.label,
          count: Number(item.count.replace(/[^0-9]/g, "")),
          amount: item.amount,
          description: monthlyDescriptions[item.key] ?? "월마감 전 확인이 필요한 거래입니다.",
          openKey: String(item.key)
        }))
        .filter((item) => item.count > 0),
    [displayItems]
  );

  useEffect(() => {
    onTaskCountChange?.(taskCount);
  }, [onTaskCountChange, taskCount]);

  useEffect(() => {
    onTaskItemsChange?.(taskItems);
  }, [onTaskItemsChange, taskItems]);

  useEffect(() => {
    const openMonthlyItem = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      const item = displayItems.find((entry) => entry.key === key);
      if (item) void openItem(item);
    };
    window.addEventListener("icbanq:home-open-monthly-task", openMonthlyItem);
    return () => window.removeEventListener("icbanq:home-open-monthly-task", openMonthlyItem);
  }, [displayItems, snapshot]);

  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-[950] tracking-[-0.02em] text-[#111827]">월마감 체크</h2>
          <p className="mt-1 truncate text-[12px] font-[750] text-[#64748b]">출고/계산서/RMA 이슈를 확인합니다.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#F39945]">{taskCount.toLocaleString("ko-KR")}건</span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-2.5 min-[1180px]:grid-cols-4">
        {displayItems.map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => void openItem(item)}
            className={`flex h-[128px] min-w-0 flex-col justify-center overflow-hidden rounded-[16px] border bg-[#fbfcff] px-3.5 py-3 text-left shadow-[0_4px_10px_rgba(15,23,42,0.022)] transition hover:border-[#1D50A2] hover:bg-white ${
              hasCount(item.count) ? "border-[#cbd5e1] ring-1 ring-[#e2e8f0]" : "border-[#edf2f8]"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
              <item.icon size={15} />
            </span>
            <p className="mt-1.5 line-clamp-2 text-[11px] font-[800] leading-[1.2] text-[#475569]">{item.label}</p>
            <p className={`mt-0.5 truncate text-[21px] font-[900] leading-none tracking-[-0.02em] ${item.tone === "needCheck" ? "text-[#F39945]" : "text-[#111827]"}`}>
              {item.count}
            </p>
            <p className="mt-1 truncate text-[9.5px] font-[650] leading-none text-[#64748b]">{item.amount}</p>
          </button>
        ))}
      </div>

      <button onClick={() => (window.location.href = "/month-end")} className="mt-4 h-[44px] w-full rounded-[14px] border border-[#e9eef6] bg-[#f8fbff] text-[13px] font-[950] text-[#1D50A2] shadow-[0_4px_10px_rgba(15,23,42,0.025)] transition hover:bg-[#edf4ff]">
        월마감 점검하기
      </button>
      <MonthlyIssueModal item={selectedItem} issues={getIssuesForItem(selectedItem)} rmaRecords={selectedItem?.key === "rma" ? scopedRmaRecords : []} onClose={() => setSelectedItem(null)} />
    </section>
  );
}
