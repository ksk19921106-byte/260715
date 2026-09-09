"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { RequestDetailModal } from "../components/RequestDetailModal";
import { ModulePage } from "@/app/components/ModulePage";
import { TEST_USERS, useSelectedUser } from "../hooks/useSelectedUser";
import { fetchRequests, type RequestItem } from "../services/requestStorage";
import { REQUEST_FORM_CONFIGS, type RequestKind } from "../services/formValidation";
import { SALES_TEAMS, getOperationsScope, isSalesNameInScope } from "../services/organization";

type RequestBucket = "received" | "processing" | "done" | "rejected";
type AdminRequestFilters = {
  month: string;
  team: string;
  person: string;
  status: "" | RequestBucket;
};

const bucketLabels: Record<RequestBucket, string> = {
  received: "접수",
  processing: "처리중",
  done: "완료",
  rejected: "반려"
};

const bucketStyles: Record<RequestBucket, string> = {
  received: "ops-status-muted",
  processing: "ops-status-attention",
  done: "ops-status-info",
  rejected: "ops-status-attention"
};

const defaultQuery = {
  scope: "",
  kind: "",
  status: "",
  requester: "",
  assignee: "",
  date: ""
};

const adminTeamOptions: string[] = [...SALES_TEAMS];
const requestKindOptions = Object.values(REQUEST_FORM_CONFIGS).map((config) => ({
  value: config.kind,
  label: config.title
}));
const defaultAdminFilters: AdminRequestFilters = {
  month: "all",
  team: "",
  person: "",
  status: ""
};

function normalizeRequestMonth(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = raw.match(/(20\d{2})[-./년\s]*(0?[1-9]|1[0-2])/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}`;
  return "";
}

function formatMonthLabel(month: string) {
  const match = String(month || "").match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if (!match) return month;
  return `${match[1]}년 ${Number(match[2])}월`;
}

function normalizeTeamName(value: string) {
  const key = String(value || "").trim();
  if (key === "영업1팀") return "B2D";
  if (key === "영업2팀") return "S2";
  if (key === "영업3팀") return "S3";
  if (adminTeamOptions.includes(key)) return key;
  return key;
}

function requestBucket(status: string): RequestBucket {
  const text = String(status);
  if (text.includes("완료") || text.includes("?꾨즺")) return "done";
  if (text.includes("반려") || text.includes("諛섎젮")) return "rejected";
  if (text.includes("처리") || text.includes("확인") || text.includes("VIPS")) return "processing";
  return "received";
}

function requesterKey(value: string) {
  return String(value || "").trim().toLowerCase();
}

function findUserByIdentity(value: string) {
  const key = requesterKey(value);
  return TEST_USERS.find((user) => requesterKey(user.name) === key || requesterKey(user.email) === key || requesterKey(user.salesName) === key);
}

function requestTeam(item: RequestItem) {
  const requester = findUserByIdentity(item.requester);
  return normalizeTeamName(requester?.team ?? "");
}

function requestPersonKeys(item: RequestItem) {
  const keys = new Set<string>();
  const requester = findUserByIdentity(item.requester);

  [item.requester, requester?.name, requester?.email, requester?.salesName, item.processor, ...(item.assignedOwners ?? [])].forEach((value) => {
    if (value) keys.add(requesterKey(value));
  });

  return keys;
}

function isOwnRequest(item: RequestItem, selectedUser: { name: string; email: string }) {
  const requester = requesterKey(item.requester);
  return requester === selectedUser.email.toLowerCase() || requester === selectedUser.name.toLowerCase();
}

function isAssignedToUser(item: RequestItem, selectedUser: { name: string; email: string }) {
  const owners = (item.assignedOwners ?? []).map((owner) => requesterKey(owner));
  return owners.includes(requesterKey(selectedUser.name)) || owners.includes(requesterKey(selectedUser.email));
}

function isVipsRequestOwner(selectedUser: { name: string }) {
  return ["sally", "gavin", "vincent"].includes(requesterKey(selectedUser.name));
}

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
}

function isToday(item: RequestItem) {
  return String(item.requestedAt || "").startsWith(todayText());
}

function kindLabel(kind?: RequestKind, fallback?: string) {
  if (kind && REQUEST_FORM_CONFIGS[kind]) return REQUEST_FORM_CONFIGS[kind].title;
  return fallback || "VIPS 요청";
}

function rejectionReason(item: RequestItem) {
  const result = String(item.result || "").trim();
  if (result && result !== "VIPS팀 접수 대기" && result !== "처리 결과 대기") return result;
  return "반려 사유 미기재";
}

function readQuery() {
  if (typeof window === "undefined") return defaultQuery;
  const params = new URLSearchParams(window.location.search);
  return {
    scope: params.get("scope") ?? "",
    kind: params.get("kind") ?? "",
    status: params.get("status") ?? "",
    requester: params.get("requester") ?? "",
    assignee: params.get("assignee") ?? "",
    date: params.get("date") ?? ""
  };
}

function readAdminFilters(): AdminRequestFilters {
  if (typeof window === "undefined") return defaultAdminFilters;
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") ?? "";
  return {
    month: params.get("month") ?? "all",
    team: params.get("team") ?? "",
    person: params.get("person") ?? "",
    status: ["received", "processing", "done", "rejected"].includes(status) ? (status as RequestBucket) : ""
  };
}

export default function RequestStatusPage() {
  const { selectedUser } = useSelectedUser();
  const operationsScope = useMemo(() => getOperationsScope(selectedUser), [selectedUser]);
  const isSupervisor = selectedUser.role === "SALES" && operationsScope.canViewOperations;
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailRequest, setDetailRequest] = useState<RequestItem | null>(null);
  const [query, setQuery] = useState(defaultQuery);
  const [adminFilters, setAdminFilters] = useState(defaultAdminFilters);
  const [showRejectedAlert, setShowRejectedAlert] = useState(false);

  useEffect(() => {
    setQuery(readQuery());
    setAdminFilters(readAdminFilters());
    fetchRequests()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const visibleItems = useMemo(() => {
    const isAdminUser = selectedUser.accessRole === "admin";
    const isOpsAll = (isAdminUser && query.scope === "opsAll") || isSupervisor;
    const vipsOwnerMode = isAdminUser && isVipsRequestOwner(selectedUser) && !isOpsAll;
    const kindSet = new Set(query.kind.split(",").map((value) => value.trim()).filter(Boolean));
    const requesterSet = new Set(query.requester.split(",").map((value) => requesterKey(value)).filter(Boolean));
    const assigneeSet = new Set(query.assignee.split(",").map((value) => requesterKey(value)).filter(Boolean));

    return items
      .filter((item) => {
        if (isSupervisor) {
          const requester = findUserByIdentity(item.requester);
          if (!requester || !isSalesNameInScope(requester.salesName, operationsScope)) return false;
        }
        if (vipsOwnerMode && !isAssignedToUser(item, selectedUser)) return false;
        if (!isOpsAll && !vipsOwnerMode && !isOwnRequest(item, selectedUser) && !isAssignedToUser(item, selectedUser)) return false;
        if (kindSet.size > 0 && (!item.kind || !kindSet.has(item.kind))) return false;
        if (query.status && requestBucket(item.status) !== query.status) return false;
        if (query.date === "today" && !isToday(item)) return false;
        if (adminFilters.month !== "all" && normalizeRequestMonth(item.requestedAt) !== adminFilters.month) return false;
        if (requesterSet.size > 0 && !requesterSet.has(requesterKey(item.requester))) return false;
        if (assigneeSet.size > 0) {
          const owners = (item.assignedOwners ?? []).map((owner) => requesterKey(owner));
          if (!owners.some((owner) => assigneeSet.has(owner))) return false;
        }
        if (isAdminUser || isSupervisor) {
          if (adminFilters.team && requestTeam(item) !== adminFilters.team) return false;
          if (adminFilters.status && requestBucket(item.status) !== adminFilters.status) return false;
          if (adminFilters.person) {
            const personKey = requesterKey(adminFilters.person);
            if (!requestPersonKeys(item).has(personKey)) return false;
          }
        }
        return true;
      })
      .sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
  }, [adminFilters, isSupervisor, items, operationsScope, query, selectedUser]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>(["2026-06"]);
    items.forEach((item) => {
      const month = normalizeRequestMonth(item.requestedAt);
      if (month) months.add(month);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [items]);

  const adminPersonOptions = useMemo(() => {
    const names = new Set<string>();
    TEST_USERS.filter((user) => !isSupervisor || isSalesNameInScope(user.salesName, operationsScope)).forEach((user) => names.add(user.name));
    items.forEach((item) => {
      const requester = findUserByIdentity(item.requester);
      if (requester && (!isSupervisor || isSalesNameInScope(requester.salesName, operationsScope))) names.add(requester.name);
      (item.assignedOwners ?? []).forEach((owner) => {
        const user = findUserByIdentity(owner);
        if (!isSupervisor || (user && isSalesNameInScope(user.salesName, operationsScope))) names.add(user?.name ?? owner);
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [isSupervisor, items, operationsScope]);

  const counts = useMemo(
    () =>
      visibleItems.reduce(
        (acc, item) => {
          acc[requestBucket(item.status)] += 1;
          return acc;
        },
        { received: 0, processing: 0, done: 0, rejected: 0 } as Record<RequestBucket, number>
      ),
    [visibleItems]
  );

  const rejectedItems = useMemo(() => visibleItems.filter((item) => requestBucket(item.status) === "rejected"), [visibleItems]);

  const isAdminUser = selectedUser.accessRole === "admin";
  const isOpsAll = (isAdminUser && query.scope === "opsAll") || isSupervisor;
  const canProcessDetail = !!detailRequest && (selectedUser.accessRole === "admin" || isAssignedToUser(detailRequest, selectedUser));
  const assignedCount = visibleItems.filter((item) => isAssignedToUser(item, selectedUser)).length;
  const ownCount = visibleItems.filter((item) => isOwnRequest(item, selectedUser)).length;
  const description = isOpsAll
    ? `${operationsScope.label} 범위에서 Sales가 올린 VIPS팀 요청을 확인합니다.`
    : selectedUser.role === "VIPS"
      ? "나에게 배정된 VIPS팀 요청의 접수, 처리 상태, 처리결과를 확인합니다."
      : "내가 요청했거나 나에게 배정된 VIPS팀 업무의 접수, 처리 상태, 처리결과를 확인합니다.";

  useEffect(() => {
    if (loading) return;
    if (selectedUser.accessRole === "admin") return;
    if (counts.rejected <= 0) return;
    setShowRejectedAlert(true);
  }, [counts.rejected, loading, selectedUser.accessRole]);

  return (
    <ModulePage eyebrow="Request Status" title="요청 현황" description={description}>
      <div className="space-y-5">
        {showRejectedAlert ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/28 px-4 py-6 backdrop-blur-[2px]">
            <section className="w-full max-w-[560px] overflow-hidden rounded-[26px] border border-[#fecaca] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#fee2e2] bg-[#fff1f2] px-6 py-5">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#dc2626]">
                    <AlertTriangle size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-[950] uppercase tracking-[0.1em] text-[#dc2626]">Rejected Request Alert</p>
                    <h2 className="mt-1 text-[22px] font-[950] tracking-[-0.03em] text-[#111827]">반려된 요청이 {counts.rejected}건 있습니다.</h2>
                    <p className="mt-2 text-[13px] font-[750] leading-5 text-[#64748b]">반려 사유를 확인하고 보완 후 다시 요청해주세요.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowRejectedAlert(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#64748b] transition hover:bg-[#fee2e2]">
                  <X size={18} />
                </button>
              </div>
              <div className="px-6 py-5">
                <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {rejectedItems.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDetailRequest(item);
                        setShowRejectedAlert(false);
                      }}
                      className="w-full rounded-[18px] border border-[#fecaca] bg-[#fffafa] p-4 text-left transition hover:border-[#dc2626] hover:bg-white"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0">
                          <b className="block truncate text-[14px] font-[950] text-[#111827]">{kindLabel(item.kind, item.type)}</b>
                          <span className="mt-1 block truncate text-[11px] font-[800] text-[#94a3b8]">{item.id} · {item.requester}</span>
                        </span>
                        <span className="shrink-0 rounded-full border border-[#fecaca] bg-white px-2.5 py-1 text-[10px] font-[950] text-[#dc2626]">반려</span>
                      </div>
                      <div className="mt-3 rounded-[14px] bg-white px-3 py-2">
                        <p className="text-[11px] font-[900] text-[#dc2626]">반려 사유</p>
                        <p className="mt-1 line-clamp-2 text-[12px] font-[750] leading-5 text-[#334155]">{rejectionReason(item)}</p>
                      </div>
                    </button>
                  ))}
                  {rejectedItems.length > 5 ? (
                    <p className="rounded-[14px] bg-[#fff7f7] px-3 py-2 text-center text-[11px] font-[850] text-[#dc2626]">
                      외 {rejectedItems.length - 5}건은 반려건만 보기에서 확인할 수 있습니다.
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 rounded-[18px] border border-[#fecaca] bg-[#fff7f7] p-4">
                  <p className="text-[14px] font-[950] text-[#111827]">확인 순서</p>
                  <p className="mt-2 text-[12px] font-[750] leading-5 text-[#64748b]">요청 상세 열기 → 처리 메모/반려 사유 확인 → 누락 정보 보완 → 재요청</p>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowRejectedAlert(false)} className="h-10 rounded-full border border-[#fecaca] bg-white px-4 text-[12px] font-[900] text-[#dc2626]">
                    확인했습니다
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminFilters((current) => ({ ...current, status: "rejected" }));
                      setShowRejectedAlert(false);
                    }}
                    className="h-10 rounded-full bg-[#dc2626] px-5 text-[12px] font-[950] text-white"
                  >
                    반려건만 보기
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
          <article className="rounded-[24px] border border-white bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
            <div className="relative mx-auto h-[104px] w-[104px] overflow-hidden rounded-full bg-[#eaf3ff] shadow-[inset_0_0_0_1px_rgba(29,80,162,0.08)]">
              <Image src="/assets/brand/bandol-full.png" alt="ICBANQ 반돌이" fill sizes="104px" className="object-contain p-2" priority />
            </div>
            <div className="mt-4 text-center">
              <p className="text-[18px] font-[950] tracking-[-0.02em] text-[#10203f]">{selectedUser.name}님</p>
              <p className="mt-1 text-[12px] font-[800] text-[#64748b]">{selectedUser.role === "VIPS" ? "VIPS 담당자" : "SALES 담당자"}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[16px] bg-[#f5f9ff] px-4 py-3 text-center">
                <p className="text-[11px] font-[900] text-[#64748b]">내 요청</p>
                <p className="mt-1 text-[22px] font-[950] text-[#10203f]">{ownCount}</p>
              </div>
              <div className="rounded-[16px] bg-[#edf4ff] px-4 py-3 text-center">
                <p className="text-[11px] font-[900] text-[#1D50A2]">배정 업무</p>
                <p className="mt-1 text-[22px] font-[950] text-[#1D50A2]">{assignedCount}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[24px] border border-white bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-[950] tracking-[-0.02em] text-[#10203f]">요청 처리 보드</h2>
                <p className="mt-1 text-[12px] font-[750] text-[#64748b]">접수부터 완료/반려까지 현재 업무 흐름을 한눈에 확인합니다.</p>
              </div>
              <span className="rounded-full bg-[#1D50A2] px-4 py-2 text-[12px] font-[950] text-white">총 {visibleItems.length}건</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {([
                ["접수", counts.received, "received"],
                ["처리중", counts.processing, "processing"],
                ["완료", counts.done, "done"],
                ["반려", counts.rejected, "rejected"]
              ] as const).map(([label, value, bucket]) => (
                <article
                  key={bucket}
                  className={`rounded-[18px] border p-4 ${
                    bucket === "rejected" && value > 0
                      ? "border-[#fca5a5] bg-[#fff1f2] shadow-[0_10px_24px_rgba(220,38,38,0.10)]"
                      : "border-[#e6edf7] bg-[#fbfdff]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[12px] font-[900] ${bucket === "rejected" && value > 0 ? "text-[#dc2626]" : "text-[#64748b]"}`}>{label}</p>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-[900] ${bucket === "rejected" && value > 0 ? "border-[#fecaca] bg-white text-[#dc2626]" : bucketStyles[bucket]}`}>{bucketLabels[bucket]}</span>
                  </div>
                  <p className={`mt-5 text-[30px] font-[950] tracking-[-0.04em] ${bucket === "rejected" && value > 0 ? "text-[#dc2626]" : "text-[#10203f]"}`}>{value}건</p>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-[950] tracking-[-0.02em] text-[#10203f]">요청 목록</h2>
              <p className="mt-1 text-[12px] font-[750] text-[#64748b]">
                {isOpsAll ? "VIPS 운영에서 선택한 조건의 요청입니다." : selectedUser.role === "VIPS" ? "나에게 배정된 요청만 표시됩니다." : "내 요청과 배정받은 요청만 표시됩니다."}
              </p>
            </div>
            <span className="rounded-full bg-[#edf4ff] px-4 py-2 text-[12px] font-[950] text-[#1D50A2]">총 {visibleItems.length}건</span>
          </div>

          {isAdminUser || isSupervisor ? (
            <div className="mt-5 grid gap-3 rounded-[18px] border border-[#d8e4f3] bg-[#f8fbff] p-4 md:grid-cols-6">
              <label className="min-w-0">
                <span className="block text-[11px] font-[850] text-[#64748b]">월별</span>
                <select
                  value={adminFilters.month}
                  onChange={(event) => setAdminFilters((current) => ({ ...current, month: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-[13px] border border-[#d8e4f3] bg-white px-3 text-[13px] font-[750] text-[#10203f] outline-none transition focus:border-[#1D50A2]"
                >
                  <option value="all">전체 월</option>
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="block text-[11px] font-[850] text-[#64748b]">요청종류</span>
                <select
                  value={requestKindOptions.some((option) => option.value === query.kind) ? query.kind : ""}
                  onChange={(event) => setQuery((current) => ({ ...current, kind: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-[13px] border border-[#d8e4f3] bg-white px-3 text-[13px] font-[750] text-[#10203f] outline-none transition focus:border-[#1D50A2]"
                >
                  <option value="">전체 요청</option>
                  {requestKindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="block text-[11px] font-[850] text-[#64748b]">팀별</span>
                <select
                  value={adminFilters.team}
                  onChange={(event) => setAdminFilters((current) => ({ ...current, team: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-[13px] border border-[#d8e4f3] bg-white px-3 text-[13px] font-[750] text-[#10203f] outline-none transition focus:border-[#1D50A2]"
                >
                  <option value="">전체 팀</option>
                  {adminTeamOptions.filter((team) => !isSupervisor || operationsScope.teams.includes(team)).map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="block text-[11px] font-[850] text-[#64748b]">담당자별</span>
                <select
                  value={adminFilters.person}
                  onChange={(event) => setAdminFilters((current) => ({ ...current, person: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-[13px] border border-[#d8e4f3] bg-white px-3 text-[13px] font-[750] text-[#10203f] outline-none transition focus:border-[#1D50A2]"
                >
                  <option value="">전체 직원</option>
                  {adminPersonOptions.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="block text-[11px] font-[850] text-[#64748b]">상태</span>
                <select
                  value={adminFilters.status}
                  onChange={(event) => setAdminFilters((current) => ({ ...current, status: event.target.value as AdminRequestFilters["status"] }))}
                  className="mt-2 h-10 w-full rounded-[13px] border border-[#d8e4f3] bg-white px-3 text-[13px] font-[750] text-[#10203f] outline-none transition focus:border-[#1D50A2]"
                >
                  <option value="">전체 상태</option>
                  {(["received", "processing", "done", "rejected"] as RequestBucket[]).map((bucket) => (
                    <option key={bucket} value={bucket}>
                      {bucketLabels[bucket]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex min-w-0 items-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdminFilters(defaultAdminFilters);
                    setQuery((current) => ({ ...current, kind: "" }));
                  }}
                  className="h-10 flex-1 rounded-[13px] border border-[#d8e4f3] bg-white px-3 text-[12px] font-[850] text-[#1D50A2] transition hover:bg-[#edf4ff]"
                >
                  필터 초기화
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 rounded-[18px] border border-[#d8e4f3] bg-[#f8fbff] p-4 sm:grid-cols-[minmax(0,220px)_minmax(0,280px)_auto]">
              <label className="min-w-0">
                <span className="block text-[11px] font-[850] text-[#64748b]">월별</span>
                <select
                  value={adminFilters.month}
                  onChange={(event) => setAdminFilters((current) => ({ ...current, month: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-[13px] border border-[#d8e4f3] bg-white px-3 text-[13px] font-[750] text-[#10203f] outline-none transition focus:border-[#1D50A2]"
                >
                  <option value="all">전체 월</option>
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="block text-[11px] font-[850] text-[#64748b]">요청종류</span>
                <select
                  value={requestKindOptions.some((option) => option.value === query.kind) ? query.kind : ""}
                  onChange={(event) => setQuery((current) => ({ ...current, kind: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-[13px] border border-[#d8e4f3] bg-white px-3 text-[13px] font-[750] text-[#10203f] outline-none transition focus:border-[#1D50A2]"
                >
                  <option value="">전체 요청</option>
                  {requestKindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex min-w-0 items-end">
                <button
                  type="button"
                  onClick={() => {
                    setAdminFilters((current) => ({ ...current, month: "all" }));
                    setQuery((current) => ({ ...current, kind: "" }));
                  }}
                  className="h-10 rounded-[13px] border border-[#d8e4f3] bg-white px-4 text-[12px] font-[850] text-[#1D50A2] transition hover:bg-[#edf4ff]"
                >
                  필터 초기화
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-[minmax(0,1.15fr)_minmax(110px,0.75fr)_minmax(120px,0.8fr)_150px_120px_minmax(0,1fr)] rounded-[16px] bg-[#f3f8ff] px-4 py-3 text-[12px] font-[900] text-[#64748b]">
            <span>요청 종류</span>
            <span>요청자</span>
            <span>배정담당자</span>
            <span>요청일시</span>
            <span>상태</span>
            <span>처리결과</span>
          </div>

          {loading ? (
            <div className="mt-3 rounded-[18px] bg-[#f8fbff] px-4 py-12 text-center text-[13px] font-[750] text-[#64748b]">요청 현황을 불러오는 중입니다.</div>
          ) : visibleItems.length === 0 ? (
            <div className="mt-3 rounded-[18px] bg-[#f8fbff] px-4 py-12 text-center text-[13px] font-[750] text-[#64748b]">조건에 해당하는 요청이 없습니다.</div>
          ) : (
            <div className="mt-3 space-y-2.5">
              {visibleItems.map((item) => {
                const bucket = requestBucket(item.status);
                return (
                  <button
                    key={item.id}
                    onClick={() => setDetailRequest(item)}
                    className={`grid w-full grid-cols-[minmax(0,1.15fr)_minmax(110px,0.75fr)_minmax(120px,0.8fr)_150px_120px_minmax(0,1fr)] items-center rounded-[16px] border bg-white px-4 py-4 text-left text-[13px] shadow-[0_5px_16px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(23,105,232,0.09)] ${
                      bucket === "rejected" ? "border-[#fecaca] hover:border-[#fca5a5]" : "border-[#e8eef8] hover:border-[#cddff8]"
                    }`}
                  >
                    <span className="min-w-0">
                      <b className="block truncate text-[14px] font-[950] text-[#10203f]">{kindLabel(item.kind, item.type)}</b>
                      <span className="mt-1 block truncate text-[11px] font-[750] text-[#94a3b8]">{item.id}</span>
                    </span>
                    <span className="truncate font-[800] text-[#64748b]">{item.requester}</span>
                    <span className="truncate font-[900] text-[#1D50A2]">{(item.assignedOwners ?? []).join(", ") || "-"}</span>
                    <span className="font-[800] text-[#64748b]">{item.requestedAt}</span>
                    <span className={`w-fit rounded-full border px-3 py-1 text-[12px] font-[900] ${bucket === "rejected" ? "border-[#fecaca] bg-[#fff1f2] text-[#dc2626]" : bucketStyles[bucket]}`}>{bucketLabels[bucket]}</span>
                    <span className="truncate font-[800] text-[#10203f]">{item.result || "처리 결과 대기"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <RequestDetailModal
        request={detailRequest}
        canProcess={canProcessDetail}
        onClose={() => setDetailRequest(null)}
        onUpdated={(nextRequest) => {
          setItems((current) => current.map((item) => (item.id === nextRequest.id ? nextRequest : item)));
          setDetailRequest(nextRequest);
        }}
      />
    </ModulePage>
  );
}

