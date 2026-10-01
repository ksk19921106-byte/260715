"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardPaste, Eraser, Save, Search, ShieldCheck, SlidersHorizontal, Upload } from "lucide-react";
import { TEST_USERS, useSelectedUser } from "../hooks/useSelectedUser";
import { SALES_TEAMS, getOperationsScope, isSalesNameInScope } from "../services/organization";
import {
  formatKrw,
  getIssueActionLabel,
  parseClosingPaste,
  type ClosingIssue,
  type ClosingIssueType,
  type ClosingSnapshot
} from "../services/closingPasteParser";
import { saveMonthEndActionRequest } from "../services/monthEndActionStorage";
import { MonthEndReviewControls } from "../components/MonthEndReviewControls";
import { canReviewMonthEnd, ownsMonthEndIssue, saveMonthEndReview } from "../services/monthEndReview";
import { fetchMonthEndRmaSnapshot, uploadMonthEndRmaFile, type MonthEndRmaRecord, type MonthEndRmaSnapshot } from "../services/monthEndRma";

type FilterKey = "all" | "mine" | ClosingIssueType | "rma";

const SNAPSHOT_KEY = "icbanq.ops.monthEnd.latestSnapshot";

const samplePaste = `NO	TEAM	FSales / ISales	Company	Billing	GPD	GP	출고소요기간	TAX발행기간	지연AR(A)	Deduct(A)	입고O/출고X/계산서O	출고O/계산서X	입고O/출고X/계산서X	세일즈 미출고
1	B2D	Lauren / Harvey	OO전자	1,429,024	1,300,000	129,024	4	2	1,429,024	0	0	0	0	0
2	B2D	Lauren / Riley	재일전자	1,761,433	1,600,000	161,433	15	26	0	0	0	1,761,433	0	0
3	S1	Jake / Terry	아이씨	75,000	70,000	5,000	8	0	0	0	0	0	75,000	1
4	S3	Chris / Robin	나라센서	5,252,933	5,000,000	252,933	18	0	0	75,000	5,252,933	0	0	0`;

const filterOptions: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "전체" },
  { key: "invoice_required", label: "출고O/계산서X" },
  { key: "shipment_check", label: "입고O/출고X/계산서O" },
  { key: "long_pending", label: "입고O/출고X/계산서X" },
  { key: "rma", label: "RMA" }
];

const fixedTeamOptions: string[] = [...SALES_TEAMS];

const issueHelpText: Partial<Record<ClosingIssueType, string>> = {
  invoice_required: "고객사에 출고는 완료하였지만, 계산서 미발행 건",
  shipment_check: "입고 및 계산서 발행은 완료하였지만, 고객에게 출고되지 않은 건",
  long_pending: "입고된 건이지만, 고객에게 출고 및 계산서 발행하지 않은 건",
  deduct_check: "Deduct 금액 또는 사유 확인이 필요한 건",
  sales_unshipped: "Sales 미출고 상태로 출고 처리 확인이 필요한 건"
};

function issueDisplayLabel(type: ClosingIssueType, fallback?: string) {
  if (type === "invoice_required") return "출고O/계산서X";
  if (type === "shipment_check") return "입고O/출고X/계산서O";
  if (type === "long_pending") return "입고O/출고X/계산서X";
  if (type === "deduct_check") return "Deduct 확인 필요";
  if (type === "sales_unshipped") return "세일즈 미출고";
  return fallback ?? type;
}

function issueActionLabel(type: ClosingIssueType) {
  if (type === "invoice_required") return "계산서발행";
  if (type === "shipment_check") return "출고진행";
  if (type === "long_pending") return "사유 기재";
  if (type === "deduct_check") return "사유 기재";
  if (type === "sales_unshipped") return "사유 기재";
  return getIssueActionLabel(type);
}

function issueMemoPrompt(type: ClosingIssueType) {
  if (type === "invoice_required") return "계산서 발행 진행 내용 또는 보완 사유를 입력해주세요.";
  if (type === "shipment_check") return "출고 진행 내용 또는 보류 사유를 입력해주세요.";
  if (type === "long_pending") return "입고O/출고X/계산서X 상태가 남아있는 사유를 입력해주세요.";
  if (type === "deduct_check") return "Deduct 확인 사유 또는 처리 내용을 입력해주세요.";
  if (type === "sales_unshipped") return "세일즈 미출고 사유 또는 처리 계획을 입력해주세요.";
  return "확인 사유 또는 처리 내용을 입력해주세요.";
}

const priorityClass = {
  high: "border-[#f7c999] bg-[#fff5ec] text-[#b85f18]",
  medium: "border-[#f7c999] bg-[#fff5ec] text-[#b85f18]",
  low: "border-[#dbe7ff] bg-[#edf4ff] text-[#1D50A2]"
};

function readSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as ClosingSnapshot) : null;
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: ClosingSnapshot) {
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

async function readServerSnapshot() {
  try {
    const response = await fetch("/api/month-end-snapshot?latest=1", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { snapshot?: ClosingSnapshot | null };
    return data.snapshot ?? null;
  } catch {
    return null;
  }
}

async function writeServerSnapshot(snapshot: ClosingSnapshot, viewer: string) {
  const response = await fetch(`/api/month-end-snapshot?viewer=${encodeURIComponent(viewer)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(data?.message || "server snapshot save failed");
  }
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthUploadTimestamp(month: string) {
  const safeMonth = normalizeMonthValue(month) || currentMonth();
  return `${safeMonth}-01T00:00:00.000Z`;
}

function getElapsedDays(issue: ClosingIssue) {
  return Math.max(issue.shipmentDays ?? 0, issue.taxIssueDays ?? 0);
}

function getMonthEndErpUrl(issue: ClosingIssue) {
  return issue.erpUrl || issue.trackingUrl || issue.orderUrl || "";
}

function ErpShortcutButton({ url }: { url?: string }) {
  if (!url) {
    return (
      <span className="inline-flex h-8 items-center justify-center rounded-full bg-[#f8fafc] px-3 text-[11px] font-[900] text-[#94a3b8]">
        준비중
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center justify-center rounded-full bg-[#edf4ff] px-3 text-[11px] font-[950] text-[#1D50A2] transition hover:bg-[#dceaff]"
    >
      바로가기
    </a>
  );
}

function isVisibleMonthEndIssue(issue: ClosingIssue) {
  return issue.issueType === "invoice_required" || issue.issueType === "shipment_check" || issue.issueType === "long_pending";
}

function normalizeName(value: string) {
  return String(value || "").trim().toLowerCase();
}

const accountSalesNames = new Set(TEST_USERS.map((user) => normalizeName(user.salesName)));

function hasPortalAccount(issue: ClosingIssue) {
  return accountSalesNames.has(normalizeName(issue.iSales)) || accountSalesNames.has(normalizeName(issue.fSales));
}

function hasPortalSalesName(value: string) {
  return accountSalesNames.has(normalizeName(value));
}

function priorityLabel(priority: ClosingIssue["priority"]) {
  if (priority === "high") return "높음";
  if (priority === "medium") return "보통";
  return "낮음";
}

function kpiFor(issues: ClosingIssue[]) {
  const openIssues = issues.filter((issue) => issue.status === "open");
  const count = (type: ClosingIssueType) => openIssues.filter((issue) => issue.issueType === type).length;
  return {
    totalCount: openIssues.length,
    totalAmount: openIssues.reduce((sum, issue) => sum + issue.amount, 0),
    invoiceRequired: count("invoice_required"),
    shipmentCheck: count("shipment_check"),
    deductCheck: count("deduct_check")
  };
}

function buildSalesActionCards(issues: ClosingIssue[]) {
  const openIssues = issues.filter((issue) => issue.status === "open");
  const cardDefs: Array<{ type: ClosingIssueType; label: string; action: string; description: string }> = [
    {
      type: "invoice_required",
      label: "출고/계산서X",
      action: "계산서발행",
      description: "출고는 끝났지만 계산서가 아직 발행되지 않은 거래입니다."
    },
    {
      type: "shipment_check",
      label: "입고/출고X/계산서O",
      action: "출고진행",
      description: "입고와 계산서는 완료됐지만 고객 출고가 남아 있습니다."
    },
    {
      type: "long_pending",
      label: "입고/출고X/계산서X",
      action: "사유 기재",
      description: "입고 후 출고와 계산서 발행이 모두 남아 있는 거래입니다."
    }
  ];

  return cardDefs
    .map((card) => {
      const cardIssues = openIssues.filter((issue) => issue.issueType === card.type);
      return {
        ...card,
        count: cardIssues.length,
        amount: cardIssues.reduce((sum, issue) => sum + issue.amount, 0),
        urgentCount: cardIssues.filter((issue) => issue.priority === "high" || getElapsedDays(issue) >= 14).length
      };
    })
    .filter((card) => card.count > 0);
}

function groupBySales(issues: ClosingIssue[]) {
  const map = new Map<string, { fSales: string; iSales: string; totalCount: number; totalAmount: number; byType: Partial<Record<ClosingIssueType, number>> }>();

  for (const issue of issues) {
    const key = `${issue.fSales} / ${issue.iSales}`;
    const group = map.get(key) ?? { fSales: issue.fSales, iSales: issue.iSales, totalCount: 0, totalAmount: 0, byType: {} };
    group.totalCount += 1;
    group.totalAmount += issue.amount;
    group.byType[issue.issueType] = (group.byType[issue.issueType] ?? 0) + 1;
    map.set(key, group);
  }

  return Array.from(map.values()).sort((a, b) => b.totalCount - a.totalCount);
}

function visibleRmaRecords(records: MonthEndRmaRecord[], selectedSalesName: string, isAdmin: boolean) {
  const accountScoped = records.filter((record) => hasPortalSalesName(record.sales));
  if (isAdmin) return accountScoped;
  return accountScoped.filter((record) => normalizeName(record.sales) === normalizeName(selectedSalesName));
}

function normalizeMonthValue(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/(20\d{2})[-./년\s]*(0?[1-9]|1[0-2])/);
  if (match) return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
  return "";
}

function formatMonthLabel(month: string) {
  const match = String(month || "").match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if (!match) return month;
  return `${match[1]}년 ${Number(match[2])}월`;
}

export function MonthEndPasteClient() {
  const { selectedUser } = useSelectedUser();
  const isAdmin = selectedUser.accessRole === "admin";
  const operationsScope = useMemo(() => getOperationsScope(selectedUser), [selectedUser]);
  const isManager = selectedUser.role === "SALES" && operationsScope.canViewOperations;
  const [pasteText, setPasteText] = useState("");
  const [recognizedIssues, setRecognizedIssues] = useState<ClosingIssue[]>([]);
  const [snapshot, setSnapshot] = useState<ClosingSnapshot | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [uploadMonth, setUploadMonth] = useState(currentMonth());
  const [teamFilter, setTeamFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [message, setMessage] = useState(isAdmin ? "ERP 월마감 데이터를 붙여넣고 데이터 인식하기를 눌러주세요." : "VIPS팀/Admin이 업로드한 최신 월마감 데이터를 불러오는 중입니다.");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [arrangeIssue, setArrangeIssue] = useState<ClosingIssue | null>(null);
  const [arrangeMemo, setArrangeMemo] = useState("");
  const [rmaSnapshot, setRmaSnapshot] = useState<MonthEndRmaSnapshot | null>(null);
  const [rmaMessage, setRmaMessage] = useState("RMA 파일을 업로드하면 Sales별 조회 리스트가 생성됩니다.");
  const [rmaMessageType, setRmaMessageType] = useState<"info" | "success" | "error">("info");
  const [rmaUploading, setRmaUploading] = useState(false);
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueSaveError, setIssueSaveError] = useState("");
  const snapshotIssueIds = useMemo(() => new Set(snapshot?.issues.map((issue) => issue.id) || []), [snapshot]);

  useEffect(() => {
    let alive = true;

    const params = new URLSearchParams(window.location.search);
    const initialTeam = params.get("team");
    const initialSales = params.get("sales");
    const initialMonth = params.get("month");
    const initialFilter = params.get("filter") as FilterKey | null;
    if (initialTeam && (fixedTeamOptions.includes(initialTeam) || initialTeam === "all")) setTeamFilter(initialTeam);
    if (initialSales) setSalesFilter(initialSales);
    if (initialMonth) setMonthFilter(initialMonth);
    if (initialFilter && filterOptions.some((option) => option.key === initialFilter)) setFilter(initialFilter);

    const loadLatestSnapshot = async () => {
      const browserSnapshot = readSnapshot();
      if (alive && browserSnapshot) {
        setSnapshot(browserSnapshot);
      }

      const serverSnapshot = await readServerSnapshot();
      if (!alive) return;

      const latest = serverSnapshot ?? browserSnapshot;
      setSnapshot(latest);
      if (serverSnapshot) writeSnapshot(serverSnapshot);

      if (!isAdmin) {
        setMessage(latest ? "내 거래 중 아직 월마감이 완료되지 않은 건입니다." : "아직 VIPS팀/Admin이 저장한 월마감 데이터가 없습니다.");
        setMessageType(latest ? "success" : "info");
      }
    };

    loadLatestSnapshot();

    fetchMonthEndRmaSnapshot()
      .then(setRmaSnapshot)
      .catch(() => setRmaSnapshot(null));

    return () => {
      alive = false;
    };
  }, [isAdmin, selectedUser.name]);

  const allIssuesRaw = isAdmin ? recognizedIssues.length > 0 ? recognizedIssues : snapshot?.issues ?? [] : snapshot?.issues ?? [];
  const allIssues = allIssuesRaw.filter((issue) => isVisibleMonthEndIssue(issue) && hasPortalAccount(issue));

  const monthFilterOptions = useMemo(() => {
    const months = new Set<string>(["2026-06"]);
    if (snapshot?.closingMonth) {
      const month = normalizeMonthValue(snapshot.closingMonth);
      if (month) months.add(month);
    }
    for (const issue of allIssues) {
      const month = normalizeMonthValue(issue.uploadedAt);
      if (month) months.add(month);
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [allIssues, snapshot?.closingMonth]);

  const permissionIssues = useMemo(() => {
    if (isAdmin) return allIssues;
    if (isManager) {
      return allIssues.filter(
        (issue) => isSalesNameInScope(issue.iSales, operationsScope) || isSalesNameInScope(issue.fSales, operationsScope)
      );
    }
    return allIssues.filter((issue) => issue.iSales === selectedUser.salesName);
  }, [allIssues, isAdmin, isManager, operationsScope, selectedUser.salesName]);

  const salesFilterOptions = useMemo(() => {
    const names = new Set<string>();
    if (isAdmin) {
      TEST_USERS.filter((user) => user.role === "SALES").forEach((user) => names.add(user.salesName));
    } else if (isManager) {
      operationsScope.memberNames.forEach((name) => names.add(name));
    }
    for (const issue of permissionIssues) {
      if (issue.fSales && accountSalesNames.has(normalizeName(issue.fSales))) names.add(issue.fSales);
      if (issue.iSales && accountSalesNames.has(normalizeName(issue.iSales))) names.add(issue.iSales);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [isAdmin, isManager, operationsScope.memberNames, permissionIssues]);

  const teamFilterOptions = useMemo(() => {
    const teams = new Set(isAdmin ? fixedTeamOptions : operationsScope.teams);
    for (const issue of permissionIssues) {
      if (issue.team) teams.add(issue.team);
    }
    return Array.from(teams).sort((a, b) => {
      const aIndex = fixedTeamOptions.indexOf(a);
      const bIndex = fixedTeamOptions.indexOf(b);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [isAdmin, operationsScope.teams, permissionIssues]);

  const filteredIssues = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return permissionIssues.filter((issue) => {
      const issueMonth = normalizeMonthValue(issue.uploadedAt) || normalizeMonthValue(snapshot?.closingMonth);
      const matchMonth = monthFilter === "all" || issueMonth === monthFilter;
      const matchTeam = teamFilter === "all" || issue.team === teamFilter;
      const matchSales = salesFilter === "all" || issue.fSales === salesFilter || issue.iSales === salesFilter;
      const matchFilter = filter === "all" || filter === "mine" || issue.issueType === filter;
      const matchQuery =
        !keyword ||
        issue.company.toLowerCase().includes(keyword) ||
        issue.fSales.toLowerCase().includes(keyword) ||
        issue.iSales.toLowerCase().includes(keyword);
      return matchMonth && matchTeam && matchSales && matchFilter && matchQuery;
    });
  }, [filter, monthFilter, permissionIssues, query, salesFilter, snapshot?.closingMonth, teamFilter]);

  const metricIssues = useMemo(
    () =>
      permissionIssues.filter((issue) => {
        const issueMonth = normalizeMonthValue(issue.uploadedAt) || normalizeMonthValue(snapshot?.closingMonth);
        const matchMonth = monthFilter === "all" || issueMonth === monthFilter;
        const matchTeam = teamFilter === "all" || issue.team === teamFilter;
        const matchSales = salesFilter === "all" || issue.fSales === salesFilter || issue.iSales === salesFilter;
        return matchMonth && matchTeam && matchSales;
      }),
    [monthFilter, permissionIssues, salesFilter, snapshot?.closingMonth, teamFilter]
  );
  const kpi = useMemo(() => kpiFor(metricIssues), [metricIssues]);
  const salesGroups = useMemo(() => groupBySales(metricIssues), [metricIssues]);
  const salesActionCards = useMemo(() => buildSalesActionCards(metricIssues), [metricIssues]);
  const rmaRecords = useMemo(() => {
    const records = (rmaSnapshot?.records ?? []).filter((record) => hasPortalSalesName(record.sales));
    if (isAdmin) return records;
    if (isManager) return records.filter((record) => isSalesNameInScope(record.sales, operationsScope));
    return records.filter((record) => normalizeName(record.sales) === normalizeName(selectedUser.salesName));
  }, [isAdmin, isManager, operationsScope, rmaSnapshot, selectedUser.salesName]);

  const recognizeData = (text = pasteText) => {
    const uploadedAt = monthUploadTimestamp(uploadMonth);
    const result = parseClosingPaste(text, selectedUser.name, uploadedAt);
    setMessage(result.message);
    setMessageType(result.ok ? "success" : "error");
    setRecognizedIssues(result.ok ? result.issues : []);
    if (result.ok) {
      setFilter("all");
      setMonthFilter(uploadMonth);
      setTeamFilter("all");
      setSalesFilter("all");
      setQuery("");
    }
  };

  const saveRecognizedData = async () => {
    if (!recognizedIssues.length) {
      setMessage("저장할 인식 데이터가 없습니다. 먼저 데이터 인식하기를 눌러주세요.");
      setMessageType("error");
      return;
    }

    const uploadedAt = new Date().toISOString();
    const monthIssueTimestamp = monthUploadTimestamp(uploadMonth);
    const issuesForSelectedMonth = recognizedIssues.map((issue) => ({
      ...issue,
      id: issue.id.replace(issue.uploadedAt, monthIssueTimestamp),
      uploadedAt: monthIssueTimestamp,
      uploadedBy: selectedUser.name
    }));
    const nextSnapshot: ClosingSnapshot = {
      id: `closing-${uploadedAt}`,
      closingMonth: uploadMonth,
      uploadedAt,
      uploadedBy: selectedUser.name,
      rawText: pasteText,
      issues: issuesForSelectedMonth
    };
    writeSnapshot(nextSnapshot);
    setSnapshot(nextSnapshot);

    try {
      await writeServerSnapshot(nextSnapshot, selectedUser.name);
      setMonthFilter(uploadMonth);
      setRecognizedIssues(issuesForSelectedMonth);
      setMessage(`저장 완료: ${formatMonthLabel(uploadMonth)} 월마감 이슈 ${issuesForSelectedMonth.length}건이 영업별로 배포되었습니다.`);
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? `브라우저에는 저장되었지만 공용 저장소에는 반영하지 못했습니다. ${error.message}` : "브라우저에는 저장되었지만 공용 저장소에는 반영하지 못했습니다.");
      setMessageType("error");
    }
  };

  const loadSample = () => {
    setPasteText(samplePaste);
    recognizeData(samplePaste);
  };

  const resetData = () => {
    setPasteText("");
    setRecognizedIssues([]);
    setFilter("all");
    setMonthFilter("all");
    setTeamFilter("all");
    setSalesFilter("all");
    setQuery("");
    setMessage("ERP 월마감 데이터를 붙여넣고 데이터 인식하기를 눌러주세요.");
    setMessageType("info");
  };

  const handleRmaUpload = async (file: File | undefined) => {
    if (!file) return;
    setRmaUploading(true);
    setRmaMessageType("info");
    setRmaMessage("RMA 파일을 인식하는 중입니다.");
    try {
      const nextSnapshot = await uploadMonthEndRmaFile(file, selectedUser.name);
      setRmaSnapshot(nextSnapshot);
      setFilter("rma");
      setRmaMessage(`RMA ${nextSnapshot.records.length}건을 인식했습니다. Sales 계정별로 본인 RMA 리스트가 표시됩니다.`);
      setRmaMessageType("success");
    } catch (error) {
      setRmaMessage(error instanceof Error ? error.message : "RMA 파일 업로드 중 오류가 발생했습니다.");
      setRmaMessageType("error");
    } finally {
      setRmaUploading(false);
    }
  };

  const acceptSavedSnapshot = (next: ClosingSnapshot) => {
    setSnapshot(next);
    setRecognizedIssues((previous) => previous.length ? next.issues : previous);
  };

  const persistIssueMemo = async (issue: ClosingIssue, memo: string) => {
    if (!snapshot || !snapshotIssueIds.has(issue.id)) { setIssueSaveError("월마감 원본을 먼저 저장해주세요."); return false; }
    setIssueSaving(true); setIssueSaveError("");
    try {
      acceptSavedSnapshot(await saveMonthEndReview(snapshot.id, issue, selectedUser.name, "memo", memo));
      return true;
    } catch (error) { setIssueSaveError(error instanceof Error ? error.message : "사유를 저장하지 못했습니다."); return false; }
    finally { setIssueSaving(false); }
  };

  const saveIssueMemo = (issue: ClosingIssue) => {
    const memo = window.prompt(issueMemoPrompt(issue.issueType), issue.memo || "");
    if (memo === null) return;
    void persistIssueMemo(issue, memo);
  };

  const handleIssueAction = (issue: ClosingIssue) => {
    if (issue.issueType === "invoice_required") {
      window.location.href = `/requests/taxInvoice?user=${encodeURIComponent(selectedUser.name)}`;
      return;
    }
    if (issue.issueType === "shipment_check") {
      setArrangeIssue(issue);
      setArrangeMemo(issue.memo || "");
      return;
    }
    if (issue.issueType === "collection_check") {
      window.location.href = `/collections?user=${encodeURIComponent(selectedUser.name)}`;
      return;
    }
    saveIssueMemo(issue);
  };

  return (
    <div className="space-y-5">
      {issueSaveError ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{issueSaveError}</p> : null}
      <ArrangeModal
        issue={arrangeIssue}
        memo={arrangeMemo}
        onMemoChange={setArrangeMemo}
        onClose={() => setArrangeIssue(null)}
        onConfirm={async (issue) => {
          const memo = arrangeMemo || "출고 진행 확인";
          if (!await persistIssueMemo(issue, memo)) return;
          saveMonthEndActionRequest({ issue, memo, requestedBy: selectedUser.name });
          setArrangeIssue(null);
          window.alert("출고진행 요청이 VIPS 운영 화면에 임시 저장되었습니다. 추후 ERP API 연동 시 이 동작이 ERP 출고요청으로 연결됩니다.");
        }}
      />
      <section className="ops-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#1D50A2]">
              <ShieldCheck size={18} />
              <p className="text-[12px] font-[950] uppercase tracking-[0.08em]">
                {isAdmin ? "ADMIN UPLOAD MODE" : isManager ? "SALES LEADER VIEW" : "ISALES VIEW MODE"}
              </p>
            </div>
            <h2 className="mt-2 text-[24px] font-[950] tracking-[-0.02em] text-[#111827]">
              {isAdmin ? "ERP 월마감 데이터 업로드" : "내 월마감 체크 현황"}
            </h2>
            <p className="mt-1 text-[13px] font-[750] text-[#64748b]">
              {isAdmin
                ? "ERP 월마감 데이터를 붙여넣으면 영업별 확인 필요 거래가 자동 생성됩니다."
                : "내 거래 중 아직 월마감이 완료되지 않은 건입니다."}
            </p>
          </div>
          <div className="rounded-[16px] border border-[#e5eaf3] bg-[#f8fbff] px-4 py-3 text-right">
            <p className="text-[11px] font-[850] text-[#64748b]">현재 사용자</p>
            <p className="text-[15px] font-[950] text-[#111827]">{selectedUser.name}</p>
            <p className="text-[11px] font-[800] text-[#1D50A2]">{selectedUser.accessRole.toUpperCase()} · {selectedUser.salesName}</p>
          </div>
        </div>

        {isAdmin ? (
          <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0 overflow-hidden rounded-[18px] border border-[#dce6f3] bg-[#fbfdff] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-[950] text-[#111827]">ERP 표 복사 붙여넣기</p>
                  <p className="mt-0.5 text-[11px] font-[750] text-[#64748b]">ERP 월마감 화면에서 표 전체를 복사한 뒤 아래 영역에 붙여넣으세요.</p>
                </div>
                <ClipboardPaste size={18} className="shrink-0 text-[#1D50A2]" />
              </div>
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder="ERP 월마감 화면에서 표 영역을 복사한 뒤 여기에 붙여넣으세요."
                className="h-[168px] w-full resize-none rounded-[14px] border border-[#dce6f3] bg-white p-3 text-[12px] font-[650] leading-relaxed text-[#10203f] outline-none transition placeholder:text-[#94a3b8] focus:border-[#1D50A2] focus:ring-2 focus:ring-[#edf4ff]"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 rounded-[18px] border border-[#dce6f3] bg-white p-3">
              <label className="block rounded-[14px] border border-[#e5eaf3] bg-[#f8fbff] px-3 py-2">
                <span className="block text-[11px] font-[950] text-[#64748b]">업로드 기준월</span>
                <select
                  value={uploadMonth}
                  onChange={(event) => setUploadMonth(event.target.value)}
                  className="mt-1 h-9 w-full rounded-[12px] border border-[#dce6f3] bg-white px-3 text-[12px] font-[900] text-[#111827] outline-none"
                >
                  {Array.from(new Set([currentMonth(), "2026-07", "2026-06", ...monthFilterOptions])).sort((a, b) => b.localeCompare(a)).map((month) => (
                    <option key={month} value={month}>{formatMonthLabel(month)}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => recognizeData()}
                className="flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[#1D50A2] px-4 text-[12px] font-[950] text-white shadow-sm transition hover:bg-[#173f80]"
              >
                <ClipboardPaste size={15} />
                데이터 인식하기
              </button>
              <button
                type="button"
                onClick={saveRecognizedData}
                className="flex h-10 items-center justify-center gap-2 rounded-[14px] border border-[#dce6f3] bg-[#f8fbff] px-4 text-[12px] font-[950] text-[#1D50A2] transition hover:bg-[#edf4ff]"
              >
                <Save size={15} />
                저장하기
              </button>
              <button
                type="button"
                onClick={loadSample}
                className="h-9 rounded-[13px] border border-[#e5eaf3] bg-white px-3 text-[12px] font-[900] text-[#475569] transition hover:bg-[#f8fbff]"
              >
                예시 데이터 불러오기
              </button>
              <button
                type="button"
                onClick={resetData}
                className="flex h-9 items-center justify-center gap-2 rounded-[13px] border border-[#e5eaf3] bg-white px-3 text-[12px] font-[900] text-[#64748b] transition hover:bg-[#f8fbff]"
              >
                <Eraser size={14} />
                초기화
              </button>
              <div className={`mt-auto rounded-[14px] border px-3 py-2 text-[11px] font-[800] leading-relaxed ${
                messageType === "error"
                  ? "border-[#fecaca] bg-[#fff5ec] text-[#b85f18]"
                  : messageType === "success"
                    ? "border-[#dbe7ff] bg-[#edf4ff] text-[#1D50A2]"
                    : "border-[#e5eaf3] bg-[#f8fbff] text-[#64748b]"
              }`}>
                {message}
              </div>
            </div>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-4 rounded-[18px] border border-[#dce6f3] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[#1D50A2]">
                  <Upload size={16} />
                  <p className="text-[12px] font-[950] uppercase tracking-[0.08em]">RMA FILE UPLOAD</p>
                </div>
                <h3 className="mt-1 text-[16px] font-[950] text-[#111827]">RMA 파일 업로드</h3>
                <p className="mt-1 text-[12px] font-[750] text-[#64748b]">
                  Sales, Supplier, P.status, W.status 컬럼을 읽어 Sales별 RMA 리스트를 생성합니다.
                </p>
              </div>
              <label className="flex h-10 cursor-pointer items-center rounded-[14px] bg-[#1D50A2] px-4 text-[12px] font-[950] text-white shadow-sm transition hover:bg-[#173f80]">
                {rmaUploading ? "업로드 중" : "RMA 파일 선택"}
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  disabled={rmaUploading}
                  className="hidden"
                  onChange={(event) => {
                    handleRmaUpload(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <div className={`mt-3 rounded-[14px] border px-3 py-2 text-[11px] font-[800] leading-relaxed ${
              rmaMessageType === "error"
                ? "border-[#fecaca] bg-[#fff5ec] text-[#b85f18]"
                : rmaMessageType === "success"
                  ? "border-[#dbe7ff] bg-[#edf4ff] text-[#1D50A2]"
                  : "border-[#e5eaf3] bg-[#f8fbff] text-[#64748b]"
            }`}>
              {rmaMessage}
              {rmaSnapshot ? (
                <span className="ml-2 text-[#94a3b8]">
                  마지막 업로드 {rmaSnapshot.fileName} · {new Date(rmaSnapshot.uploadedAt).toLocaleString("ko-KR")}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {snapshot ? (
          <div className="mt-4 rounded-[16px] border border-[#e5eaf3] bg-[#fbfdff] px-4 py-3 text-[12px] font-[800] text-[#64748b]">
            마지막 업로드 {snapshot.closingMonth} · {new Date(snapshot.uploadedAt).toLocaleString("ko-KR")} · 업로드 {snapshot.uploadedBy}
          </div>
        ) : null}
      </section>

        {!isAdmin ? (
          <section className="ops-card w-full min-w-0 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">My Month-End Actions</p>
                <h3 className="mt-1 text-[20px] font-[950] tracking-[-0.03em] text-[#111827]">내가 먼저 처리할 월마감 업무</h3>
                <p className="mt-1 text-[12px] font-[750] text-[#64748b]">표를 해석하기 전에, 지금 남아있는 업무를 액션 기준으로 먼저 보여줍니다.</p>
              </div>
              <span className="rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#F39945]">
                총 {metricIssues.filter((issue) => issue.status === "open").length.toLocaleString("ko-KR")}건
              </span>
            </div>

            {salesActionCards.length === 0 ? (
              <div className="mt-4 rounded-[18px] border border-[#e5eaf3] bg-[#f8fbff] px-4 py-5 text-[13px] font-[850] text-[#64748b]">
                현재 내 월마감 처리 대상이 없습니다.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {salesActionCards.map((card) => (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => setFilter(card.type)}
                    className={`min-h-[154px] rounded-[20px] border bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:border-[#1D50A2] ${
                      filter === card.type ? "border-[#1D50A2] ring-2 ring-[#dbeafe]" : "border-[#dbe5f1]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-[950] text-[#111827]">{card.label}</p>
                        <p className="mt-1 line-clamp-2 text-[12px] font-[750] leading-[1.45] text-[#64748b]">{card.description}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#edf4ff] px-2.5 py-1 text-[11px] font-[950] text-[#1D50A2]">{card.action}</span>
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[28px] font-[950] leading-none tracking-[-0.03em] text-[#F39945]">{card.count.toLocaleString("ko-KR")}건</p>
                        <p className="mt-1 text-[12px] font-[800] text-[#64748b]">{formatKrw(card.amount)}</p>
                      </div>
                      <p className="rounded-full bg-[#fff5ec] px-2.5 py-1 text-[11px] font-[900] text-[#b85f18]">긴급 {card.urgentCount}건</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="w-full min-w-0">
          <article className="ops-card w-full min-w-0 overflow-hidden p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[18px] font-[950] text-[#111827]">{isAdmin ? "월마감 이슈 전체" : "내 월마감 이슈"}</h3>
              <p className="mt-1 text-[12px] font-[750] text-[#64748b]">ERP 데이터를 영업 행동 기준으로 번역해 확인이 필요한 거래만 보여줍니다.</p>
            </div>
            <div className="flex h-10 min-w-[220px] items-center gap-2 rounded-xl border border-[#dce6f3] bg-[#fbfdff] px-3">
              <Search size={15} className="text-[#94a3b8]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="거래처, FSales, ISales 검색"
                className="min-w-0 flex-1 bg-transparent text-[12px] font-[800] text-[#10203f] outline-none placeholder:text-[#94a3b8]"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[16px] border border-[#e5eaf3] bg-[#fbfdff] px-3 py-3">
            <span className="text-[12px] font-[950] text-[#64748b]">월별</span>
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="h-9 rounded-full border border-[#dce6f3] bg-white px-3 text-[12px] font-[900] text-[#111827] outline-none"
            >
              <option value="all">전체 월</option>
              {monthFilterOptions.map((month) => (
                <option key={month} value={month}>{formatMonthLabel(month)}</option>
              ))}
            </select>
            {isAdmin || isManager ? (
              <>
                <span className="text-[12px] font-[950] text-[#64748b]">팀 필터</span>
                <select
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                  className="h-9 rounded-full border border-[#dce6f3] bg-white px-3 text-[12px] font-[900] text-[#111827] outline-none"
                >
                  <option value="all">전체 팀</option>
                  {teamFilterOptions.map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
                <span className="text-[12px] font-[950] text-[#64748b]">담당자 필터</span>
                <select
                  value={salesFilter}
                  onChange={(event) => setSalesFilter(event.target.value)}
                  className="h-9 rounded-full border border-[#dce6f3] bg-white px-3 text-[12px] font-[900] text-[#111827] outline-none"
                >
                  <option value="all">전체 담당자</option>
                  {salesFilterOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                title={issueHelpText[option.key as ClosingIssueType] ?? option.label}
                className={`h-9 rounded-full px-4 text-[12px] font-[900] transition ${
                  filter === option.key ? "bg-[#1D50A2] text-white" : "border border-[#e5eaf3] bg-white text-[#475569] hover:bg-[#f8fbff]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {filter === "rma" ? (
            <div className="mt-4 overflow-hidden rounded-[18px] border border-[#e7ecf4]">
              <div className="grid min-w-[760px] grid-cols-[130px_minmax(240px,1fr)_140px_140px] gap-2 bg-[#f8fbff] px-4 py-3 text-[11px] font-[950] text-[#64748b]">
                <span>Sales</span>
                <span>Supplier</span>
                <span>P.status</span>
                <span>W.status</span>
              </div>
              <div className="max-h-[420px] overflow-auto">
                {rmaRecords.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-[13px] font-[900] text-[#64748b]">표시할 RMA 데이터가 없습니다.</p>
                    <p className="mt-1 text-[12px] font-[750] text-[#94a3b8]">
                      {isAdmin ? "Admin 계정으로 RMA 파일을 업로드해주세요." : "내 Sales명으로 등록된 RMA가 없습니다."}
                    </p>
                  </div>
                ) : (
                  rmaRecords.map((record) => (
                    <div key={record.id} className="grid min-w-[760px] grid-cols-[130px_minmax(240px,1fr)_140px_140px] items-center gap-2 border-t border-[#eef2f7] bg-white px-4 py-3 text-[12px]">
                      <span className="truncate font-[950] text-[#475569]">{record.sales}</span>
                      <span className="truncate font-[900] text-[#111827]">{record.supplier || "-"}</span>
                      <span className="w-fit rounded-full border border-[#dce6f3] bg-[#fbfdff] px-3 py-1 text-[11px] font-[900] text-[#1D50A2]">{record.purchaseStatus || "-"}</span>
                      <span className="w-fit rounded-full border border-[#dce6f3] bg-[#fbfdff] px-3 py-1 text-[11px] font-[900] text-[#475569]">{record.warehouseStatus || "-"}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-[#eef2f7] bg-[#fbfdff] px-4 py-3 text-[12px] font-[800] text-[#64748b]">
                RMA는 확인용 리스트입니다. 사유 입력이나 액션 처리는 제공하지 않습니다.
              </div>
            </div>
          ) : (
          <div className="mt-4 max-h-[580px] overflow-auto rounded-[18px] border border-[#e7ecf4]">
            <div className="sticky top-0 z-10 grid min-w-[1490px] grid-cols-[110px_170px_minmax(210px,1fr)_120px_120px_80px_100px_minmax(230px,1.1fr)_150px_96px] gap-2 bg-[#f8fbff] px-4 py-3 text-[11px] font-[950] text-[#64748b]">
              <span>ISales</span>
              <span>상태</span>
              <span>거래처(Company)</span>
              <span>금액</span>
              <span>GPD</span>
              <span>GP</span>
              <span>미출고기간</span>
              <span>사유 / 완료 검토</span>
              <span>액션</span>
              <span>바로가기</span>
            </div>
            <div>
              {filteredIssues.length === 0 ? (
                <p className="p-6 text-center text-[13px] font-[850] text-[#64748b]">조건에 맞는 이슈가 없습니다.</p>
              ) : (
                filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`grid min-w-[1490px] grid-cols-[110px_170px_minmax(210px,1fr)_120px_120px_80px_100px_minmax(230px,1.1fr)_150px_96px] items-center gap-2 border-t border-[#eef2f7] px-4 py-3 text-[12px] ${
                      issue.status !== "open" ? "bg-[#f8fafc] opacity-60" : "bg-white"
                    }`}
                  >
                    <span className="truncate font-[900] text-[#475569]">{issue.iSales}</span>
                    <span className="truncate font-[900] text-[#111827]" title={issueHelpText[issue.issueType] ?? issue.issueLabel}>
                      {issueDisplayLabel(issue.issueType, issue.issueLabel)}
                    </span>
                    <span className="truncate font-[850] text-[#10203f]">{issue.company}</span>
                    <span className="truncate font-[900] text-[#111827]">{formatKrw(issue.amount)}</span>
                    <span className="truncate font-[900] text-[#475569]">{issue.gpdAmount ? formatKrw(issue.gpdAmount) : "-"}</span>
                    <span className="font-[850] text-[#64748b]">{typeof issue.gpRate === "number" ? `${issue.gpRate}%` : "-"}</span>
                    <span className="font-[850] text-[#64748b]">
                      {issue.issueType === "invoice_required" ? "-" : `${issue.shipmentDays ?? getElapsedDays(issue)}일`}
                    </span>
                    <div className="min-w-0 space-y-2"><button
                      type="button"
                      onClick={() => saveIssueMemo(issue)}
                      disabled={issueSaving || issue.status !== "open" || (!canReviewMonthEnd(selectedUser) && !ownsMonthEndIssue(issue, selectedUser))}
                      className={`w-full min-w-0 rounded-[12px] border px-3 py-2 text-left text-[12px] font-[800] transition hover:border-[#1D50A2] hover:bg-[#f8fbff] ${
                        issue.memo ? "border-[#dce6f3] bg-white text-[#334155]" : "border-dashed border-[#cbd5e1] bg-[#fbfdff] text-[#94a3b8]"
                      }`}
                      title={issue.memo || "Sales가 직접 사유를 입력합니다."}
                    >
                      <span className="block truncate">{issue.memo || "사유 입력/수정"}</span>
                    </button>
                    {snapshot && snapshotIssueIds.has(issue.id) ? <MonthEndReviewControls snapshotId={snapshot.id} issue={issue} user={selectedUser} onSaved={acceptSavedSnapshot} disabled={issueSaving} /> : null}
                    </div>
                    <span className="flex gap-1.5">
                      <button type="button" disabled={issueSaving || issue.status !== "open" || (!canReviewMonthEnd(selectedUser) && !ownsMonthEndIssue(issue, selectedUser))} onClick={() => handleIssueAction(issue)} className="ops-btn-primary h-8 px-3 text-[11px]">
                        {issueActionLabel(issue.issueType)}
                      </button>
                    </span>
                    <ErpShortcutButton url={getMonthEndErpUrl(issue)} />
                  </div>
                ))
              )}
            </div>
          </div>
          )}

          <div className="mt-4 flex items-center gap-2 rounded-[16px] bg-[#f8fbff] px-4 py-3 text-[12px] font-[800] text-[#64748b]">
            <SlidersHorizontal size={15} />
            월마감 데이터는 VIPS/Admin이 전체 데이터를 저장하고, 영업은 FSales/ISales 권한에 따라 본인 범위만 확인합니다.
          </div>
        </article>
      </section>
    </div>
  );
}

function ArrangeModal({
  issue,
  memo,
  onMemoChange,
  onClose,
  onConfirm
}: {
  issue: ClosingIssue | null;
  memo: string;
  onMemoChange: (value: string) => void;
  onClose: () => void;
  onConfirm: (issue: ClosingIssue) => void;
}) {
  if (!issue) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/35 px-4 py-6">
      <section className="w-full max-w-[880px] overflow-hidden rounded-[4px] border-4 border-[#4aa3d9] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex h-8 items-center justify-between bg-[#4aa3d9] px-3 text-white">
          <p className="text-[13px] font-[950]">상세보기</p>
          <button type="button" onClick={onClose} className="text-[12px] font-[900] text-white">× close</button>
        </div>
        <div className="bg-[#eef7fd] px-3 py-2 text-[12px] font-[950] text-[#0f5f9d]">Warehouse out Arrange</div>

        <div className="border-t border-[#b7d5e8]">
          <div className="grid grid-cols-[44px_1fr_1fr_1fr_1fr] border-b border-[#cbd5e1] text-center text-[12px]">
            <div className="bg-[#f8fafc] py-2 font-[900] text-[#0f5f9d]">선택</div>
            <div className="bg-[#f8fafc] py-2 font-[900] text-[#0f5f9d]">P/N</div>
            <div className="bg-[#f8fafc] py-2 font-[900] text-[#0f5f9d]">NAME</div>
            <div className="bg-[#f8fafc] py-2 font-[900] text-[#0f5f9d]">ADDR</div>
            <div className="bg-[#f8fafc] py-2 font-[900] text-[#0f5f9d]">계산서형태</div>
            <div className="flex items-center justify-center border-t border-[#d7e2ea] py-2">
              <input type="checkbox" checked readOnly />
            </div>
            <div className="border-t border-[#d7e2ea] px-2 py-2 font-[750] text-[#334155]">월마감 출고 확인 대상</div>
            <div className="border-t border-[#d7e2ea] px-2 py-2 font-[750] text-[#334155]">{issue.company}</div>
            <div className="border-t border-[#d7e2ea] px-2 py-2 font-[750] text-[#334155]">출고 주소 확인 필요</div>
            <div className="border-t border-[#d7e2ea] px-2 py-2 font-[750] text-[#334155]">영수</div>
          </div>

          <div className="border-t-[6px] border-[#4aa3d9]">
            {[
              ["Date", <><input value={today} readOnly className="h-7 w-[150px] border border-[#94a3b8] px-2 text-[12px]" /> <span className="ml-2 text-[11px] font-[850] text-red-500">*오전8시에서 오후2시 이후에는 당일출고가 불가능 합니다.</span></>],
              ["NAME", <input value={issue.company} readOnly className="h-7 w-[380px] border border-[#94a3b8] px-2 text-[12px]" />],
              ["ADDR", <input value="출고 주소는 IKI에서 최종 확인해주세요." readOnly className="h-7 w-full border border-[#94a3b8] px-2 text-[12px]" />],
              ["배송방법", <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]"><label><input type="radio" defaultChecked /> 택배-신용</label><label><input type="radio" /> 택배-착불</label><label><input type="radio" /> 퀵-신용</label><label><input type="radio" /> 방문수령</label><label><input type="radio" /> 취소(출고보류)</label></div>],
              ["계산서형태", <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]"><label><input type="radio" defaultChecked /> 영수</label><label><input type="radio" /> 청구</label><label><input type="radio" /> 가상발행</label><input value={today} readOnly className="h-7 w-[120px] border border-[#94a3b8] px-2 text-[12px]" /><span className="text-[11px] font-[850] text-red-500">*계산서 발행월 확인</span></div>],
              ["발송형태", <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]"><label><input type="radio" defaultChecked /> 메일발송</label><label><input type="radio" /> 박스동봉</label><label><input type="radio" /> 프린트출력</label></div>],
              ["연락처", <input placeholder="연락처 확인" className="h-7 w-[220px] border border-[#94a3b8] px-2 text-[12px]" />],
              ["월마감 메모", <textarea value={memo} onChange={(event) => onMemoChange(event.target.value)} placeholder="출고 진행 내용 또는 보류 사유를 입력해주세요." className="h-16 w-full resize-none border border-[#94a3b8] px-2 py-1 text-[12px]" />]
            ].map(([label, content]) => (
              <div key={String(label)} className="grid grid-cols-[160px_1fr] border-b border-[#d7e2ea]">
                <div className="bg-[#f8fafc] px-3 py-2 text-right text-[12px] font-[950] text-[#0f5f9d]">{label}</div>
                <div className="px-2 py-1.5">{content}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-2 bg-[#eef7fd] px-4 py-3">
          <button type="button" onClick={() => onConfirm(issue)} className="h-9 rounded-sm bg-[#6b7280] px-8 text-[12px] font-[950] text-white">
            확인
          </button>
          <button type="button" onClick={onClose} className="h-9 rounded-sm border border-[#94a3b8] bg-white px-6 text-[12px] font-[900] text-[#475569]">
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="ops-card min-w-0 overflow-hidden p-4">
      <p className="text-[11px] font-[850] text-[#64748b]">{label}</p>
      <p className={`mt-2 truncate rounded-[14px] px-3 py-2 text-[19px] font-[950] ${tone}`}>{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#e5eaf3] bg-white/85 p-4">
      <p className="text-[11px] font-[850] text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[18px] font-[950] tracking-[-0.02em] text-[#111827]">{value}</p>
    </div>
  );
}
