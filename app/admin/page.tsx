"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, FileText, RefreshCw, Save, Search, ShieldCheck, UserX } from "lucide-react";
import { AccessDenied } from "../components/AccessDenied";
import { OpsShell } from "../components/OpsShell";
import { RequestDetailModal } from "../components/RequestDetailModal";
import { TEST_USERS, useSelectedUser } from "../hooks/useSelectedUser";
import { fetchBlockedUsers, updateBlockedUser, type BlockedUserMap, type MonthEndGateStatus } from "../services/monthEndGate";
import { fetchRequests, updateRequest, type RequestItem, type RequestStatus } from "../services/requestStorage";

const statusOptions: RequestStatus[] = ["요청접수", "VIPS팀 확인중", "완료", "반려"];

const statusStyles: Record<RequestStatus, string> = {
  요청접수: "ops-status-muted",
  "VIPS팀 확인중": "ops-status-info",
  완료: "ops-status-info",
  반려: "ops-status-attention"
};

const blockStatusStyles: Record<MonthEndGateStatus, string> = {
  OK: "ops-status-info",
  BLOCK: "ops-status-attention"
};

type DraftMap = Record<string, { status: RequestStatus; result: string }>;

const defaultBlockedUsers: BlockedUserMap = Object.fromEntries(
  TEST_USERS.filter((user) => user.role === "SALES").map((user) => [user.salesName, "OK" as MonthEndGateStatus])
);

export default function AdminPage() {
  const { selectedUser } = useSelectedUser();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserMap>(defaultBlockedUsers);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [blockLoading, setBlockLoading] = useState(false);
  const [detailRequest, setDetailRequest] = useState<RequestItem | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await fetchRequests();
      setItems(data);
      setDrafts(Object.fromEntries(data.map((item) => [item.id, { status: item.status, result: item.result }])));
    } finally {
      setLoading(false);
    }
  };

  const loadBlockedUsers = async () => {
    setBlockLoading(true);
    try {
      setBlockedUsers({ ...defaultBlockedUsers, ...(await fetchBlockedUsers()) });
    } catch {
      setBlockedUsers(defaultBlockedUsers);
    } finally {
      setBlockLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    loadBlockedUsers();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.id, item.type, item.companyName, item.requester, item.requestedAt, item.status, item.result].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [items, query]);

  const statusCounts = useMemo(
    () =>
      statusOptions.map((status) => ({
        status,
        count: items.filter((item) => item.status === status).length
      })),
    [items]
  );

  const kanbanGroups = [
    { title: "접수됨", items: items.filter((item) => item.status === "요청접수") },
    { title: "확인 필요", items: items.filter((item) => item.status === "반려") },
    { title: "처리 중", items: items.filter((item) => item.status === "VIPS팀 확인중") }
  ];

  const salesUsers = useMemo(() => Object.entries({ ...defaultBlockedUsers, ...blockedUsers }).sort(([a], [b]) => a.localeCompare(b)), [blockedUsers]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2400);
  };

  const handleDraftChange = (id: string, patch: Partial<DraftMap[string]>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const handleSave = async (item: RequestItem) => {
    const draft = drafts[item.id];
    if (!draft) return;

    const updated = await updateRequest({ id: item.id, status: draft.status, result: draft.result });

    setItems((current) => current.map((currentItem) => (currentItem.id === updated.id ? updated : currentItem)));
    setDetailRequest((current) => (current?.id === updated.id ? updated : current));
    showMessage(`${item.id} 저장 완료`);
  };

  const handleBlockChange = async (user: string, status: MonthEndGateStatus) => {
    const users = await updateBlockedUser(user, status);
    setBlockedUsers(users);
    showMessage(`${user} ${status === "BLOCK" ? "차단" : "차단해제"} 완료`);
  };

  if (selectedUser.role !== "VIPS") {
    return <AccessDenied />;
  }

  return (
    <OpsShell>
      <section className="space-y-4 px-6 py-5">
        <section className="rounded-lg border border-[#dce6f3] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 text-[12px] font-[800] uppercase tracking-[0.08em] text-[#1D50A2]">
                <ShieldCheck size={16} />
                VIPS Operation
              </p>
              <h1 className="mt-1 text-[24px] font-[850] tracking-[-0.01em] text-[#10203f]">VIPS팀 운영 화면</h1>
              <p className="mt-2 text-[14px] font-[550] text-[#5b6b84]">요청 처리, 월마감 차단, 반복 패턴 분석을 한 화면에서 관리합니다.</p>
            </div>
            <div className="flex items-center gap-2">
              {message && (
                <span className="flex h-9 items-center gap-2 rounded-md border border-[rgba(29,80,162,0.18)] bg-[#edf4ff] px-3 text-[12px] font-[750] text-[#1D50A2]">
                  <CheckCircle2 size={15} />
                  {message}
                </span>
              )}
              <button
                onClick={() => {
                  loadRequests();
                  loadBlockedUsers();
                }}
                className="flex h-10 items-center gap-2 rounded-md border border-[#cfdbea] bg-white px-4 text-[13px] font-[750] text-[#31445e]"
              >
                <RefreshCw size={16} />
                새로고침
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-[1fr_1fr_1fr_1.4fr] gap-3">
            {[
              { label: "전체 요청", value: `${items.length}건` },
              { label: "처리 중", value: `${items.filter((item) => item.status === "VIPS팀 확인중").length}건` },
              { label: "반려", value: `${items.filter((item) => item.status === "반려").length}건` },
              { label: "반복 패턴", value: "수정/입금확인 중심" }
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-[#dce6f3] bg-[#f8fbff] px-4 py-3">
                <p className="text-[12px] font-[800] text-[#5b6b84]">{item.label}</p>
                <p className="mt-2 text-[20px] font-[850] text-[#10203f]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-[1fr_1.2fr] gap-4">
            <section className="rounded-md border border-[#dce6f3] bg-white p-4">
              <p className="flex items-center gap-2 text-[14px] font-[850] text-[#10203f]">
                <BarChart3 size={17} className="text-[#1D50A2]" />
                요청 상태 차트
              </p>
              <div className="mt-4 space-y-3">
                {statusCounts.map((item) => (
                  <div key={item.status}>
                    <div className="mb-1 flex justify-between text-[12px] font-[750] text-[#435a7b]">
                      <span>{item.status}</span>
                      <span>{item.count}건</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#edf3fb]">
                      <div className="h-2 rounded-full bg-[#1D50A2]" style={{ width: `${items.length ? Math.max((item.count / items.length) * 100, 8) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-[#dce6f3] bg-white p-4">
              <p className="text-[14px] font-[850] text-[#10203f]">요청 처리 칸반보드</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {kanbanGroups.map((group) => (
                  <div key={group.title} className="min-h-[120px] rounded-md bg-[#f8fbff] p-3">
                    <p className="text-[12px] font-[850] text-[#1D50A2]">{group.title}</p>
                    <div className="mt-3 space-y-2">
                      {group.items.slice(0, 3).map((item) => (
                        <button key={item.id} onClick={() => setDetailRequest(item)} className="w-full rounded border border-[#dce6f3] bg-white px-3 py-2 text-left text-[12px] font-[700] text-[#10203f]">
                          {item.type}
                          <span className="mt-1 block truncate text-[11px] font-[600] text-[#7a8ba4]">{item.companyName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-lg border border-[#dce6f3] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#dce6f3] px-6 py-5">
            <div>
              <p className="flex items-center gap-2 text-[12px] font-[800] uppercase tracking-[0.08em] text-[#1D50A2]">
                <FileText size={16} />
                Request Status Management
              </p>
              <h2 className="mt-1 text-[20px] font-[850] tracking-[-0.01em] text-[#10203f]">요청 상태 관리</h2>
            </div>
            <div className="flex h-10 w-[360px] items-center gap-2 rounded-md border border-[#cfdbea] bg-white px-3">
              <Search size={17} className="text-[#1D50A2]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="요청ID, 업체명, 상태 검색"
                className="h-full flex-1 text-[13px] font-[550] text-[#10203f] outline-none placeholder:text-[#8a9bb4]"
              />
            </div>
          </div>

          <div className="mx-6 mb-6 mt-5 overflow-hidden rounded-md border border-[#dce6f3]">
            <div className="grid grid-cols-[155px_140px_140px_170px_145px_145px_1fr_92px] bg-[#f4f8fd] px-4 py-3 text-[12px] font-[850] text-[#34496b]">
              <span>요청ID</span>
              <span>요청종류</span>
              <span>업체명</span>
              <span>요청자</span>
              <span>요청일시</span>
              <span>상태</span>
              <span>처리결과</span>
              <span className="text-center">저장</span>
            </div>

            {loading ? (
              <div className="px-4 py-12 text-center text-[13px] font-[650] text-[#5b6b84]">요청 목록을 불러오는 중입니다.</div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-12 text-center text-[13px] font-[650] text-[#5b6b84]">표시할 요청이 없습니다.</div>
            ) : (
              filteredItems.map((item) => {
                const draft = drafts[item.id] ?? { status: item.status, result: item.result };
                return (
                  <div
                    key={item.id}
                    onClick={() => setDetailRequest(item)}
                    className="grid cursor-pointer grid-cols-[155px_140px_140px_170px_145px_145px_1fr_92px] items-center border-t border-[#e5edf7] px-4 py-3 text-[13px] transition hover:bg-[#f8fbff]"
                  >
                    <span className="font-[800] text-[#10203f]">{item.id}</span>
                    <span className="font-[650] text-[#34496b]">{item.type}</span>
                    <span className="truncate pr-3 font-[700] text-[#10203f]">{item.companyName}</span>
                    <span className="truncate pr-3 font-[650] text-[#34496b]">{item.requester}</span>
                    <span className="font-[650] text-[#34496b]">{item.requestedAt}</span>
                    <select
                      value={draft.status}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => handleDraftChange(item.id, { status: event.target.value as RequestStatus })}
                      className={`h-9 rounded-full border px-3 text-[12px] font-[800] outline-none ${statusStyles[draft.status]}`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      value={draft.result}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => handleDraftChange(item.id, { result: event.target.value })}
                      placeholder="예: TX-20260518-003 발행 완료"
                      className="mr-3 h-9 rounded-md border border-[#cfdbea] bg-white px-3 text-[13px] font-[650] text-[#10203f] outline-none focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]"
                    />
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSave(item);
                      }}
                      className="mx-auto flex h-9 w-[72px] items-center justify-center gap-1 rounded-md bg-[#1D50A2] text-[12px] font-[800] text-white"
                    >
                      <Save size={14} />
                      저장
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[#dce6f3] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#dce6f3] px-6 py-5">
            <div>
              <p className="flex items-center gap-2 text-[12px] font-[800] uppercase tracking-[0.08em] text-[#1D50A2]">
                <UserX size={16} />
                Month-End Gatekeeper
              </p>
              <h2 className="mt-1 text-[20px] font-[850] tracking-[-0.01em] text-[#10203f]">월마감 차단관리</h2>
              <p className="mt-1 text-[13px] font-[550] text-[#5b6b84]">ERP에서 월마감 미완료 여부를 확인한 뒤 포털 요청 차단 상태를 관리합니다.</p>
            </div>
            <div className="rounded-md bg-[#f8fbff] px-4 py-2 text-[12px] font-[700] text-[#435a7b]">data/blocked-users.json</div>
          </div>

          <div className="mx-6 my-6 overflow-hidden rounded-md border border-[#dce6f3]">
            <div className="grid grid-cols-[1fr_160px_240px] bg-[#f4f8fd] px-4 py-3 text-[12px] font-[850] text-[#34496b]">
              <span>SALES 담당자</span>
              <span>상태</span>
              <span className="text-center">관리</span>
            </div>

            {blockLoading ? (
              <div className="px-4 py-10 text-center text-[13px] font-[650] text-[#5b6b84]">차단 목록을 불러오는 중입니다.</div>
            ) : (
              salesUsers.map(([user, status]) => (
                <div key={user} data-block-user-row={user} className="grid grid-cols-[1fr_160px_240px] items-center border-t border-[#e5edf7] px-4 py-3 text-[13px]">
                  <div>
                    <p className="font-[800] text-[#10203f]">{user}</p>
                    <p className="mt-1 text-[11px] font-[550] text-[#7a8ba4]">월마감 Gate 상태</p>
                  </div>
                  <span data-block-status={user} className={`w-fit rounded-full border px-3 py-1 text-[12px] font-[850] ${blockStatusStyles[status]}`}>{status === "BLOCK" ? "차단" : "정상"}</span>
                  <div className="flex justify-center gap-2">
                    <button
                      data-block-action="BLOCK"
                      data-block-user={user}
                      onClick={() => handleBlockChange(user, "BLOCK")}
                      disabled={status === "BLOCK"}
                      className={`h-9 rounded-md px-4 text-[12px] font-[850] ${status === "BLOCK" ? "cursor-not-allowed bg-[#d7e1ef] text-[#74849b]" : "bg-[#F39945] text-white"}`}
                    >
                      차단
                    </button>
                    <button
                      data-block-action="OK"
                      data-block-user={user}
                      onClick={() => handleBlockChange(user, "OK")}
                      disabled={status === "OK"}
                      className={`h-9 rounded-md px-4 text-[12px] font-[850] ${status === "OK" ? "cursor-not-allowed bg-[#d7e1ef] text-[#74849b]" : "bg-[#1D50A2] text-white"}`}
                    >
                      차단해제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (() => {
                  const statusClass = {
                    OK: "w-fit rounded-full border px-3 py-1 text-[12px] font-[850] ops-status-info",
                    BLOCK: "w-fit rounded-full border px-3 py-1 text-[12px] font-[850] ops-status-attention"
                  };
                  const applyStatus = (user, status) => {
                    const statusTarget = document.querySelector('[data-block-status="' + user + '"]');
                    if (statusTarget) {
                      statusTarget.className = statusClass[status];
                      statusTarget.textContent = status === "BLOCK" ? "차단" : "정상";
                    }
                    document.querySelectorAll('[data-block-user="' + user + '"]').forEach((button) => {
                      const action = button.getAttribute("data-block-action");
                      const disabled = action === status;
                      button.disabled = disabled;
                      button.className = disabled
                        ? "h-9 rounded-md px-4 text-[12px] font-[850] cursor-not-allowed bg-[#d7e1ef] text-[#74849b]"
                        : action === "BLOCK"
                          ? "h-9 rounded-md px-4 text-[12px] font-[850] bg-[#F39945] text-white"
                          : "h-9 rounded-md px-4 text-[12px] font-[850] bg-[#1D50A2] text-white";
                    });
                  };
                  const bindButtons = () => {
                    document.querySelectorAll("[data-block-action][data-block-user]").forEach((button) => {
                      if (button.dataset.bound === "true") return;
                      button.dataset.bound = "true";
                      button.addEventListener("click", async () => {
                        const user = button.getAttribute("data-block-user");
                        const status = button.getAttribute("data-block-action");
                        applyStatus(user, status);
                        try {
                          const response = await fetch("/api/month-end/blocked", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user, status })
                          });
                          const data = await response.json();
                          if (data && data.users) {
                            Object.entries(data.users).forEach(([name, value]) => applyStatus(name, value));
                          }
                        } catch {
                          applyStatus(user, status);
                        }
                      });
                    });
                  };
                  const loadStatuses = async () => {
                    try {
                      const response = await fetch("/api/month-end/blocked", { cache: "no-store" });
                      const data = await response.json();
                      const users = { ...defaultBlockedUsers, ...(data.users || {}) };
                      Object.entries(users).forEach(([user, status]) => applyStatus(user, status));
                    } catch {
                      Object.keys(defaultBlockedUsers).forEach((user) => applyStatus(user, "OK"));
                    }
                  };
                  bindButtons();
                  loadStatuses();
                  window.clearInterval(window.__icbanqBlockAdminTimer);
                  window.__icbanqBlockAdminTimer = window.setInterval(bindButtons, 300);
                })();
              `
            }}
          />
        </section>

        <section className="rounded-lg border border-[#dce6f3] bg-white p-6 shadow-sm">
          <p className="text-[17px] font-[850] text-[#10203f]">반복 패턴 분석</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {["SALES별 요청 추이", "반려/실수 유형", "흐름 병목 지점"].map((item) => (
              <div key={item} className="rounded-md border border-dashed border-[#c6d4e9] bg-[#f8fbff] px-4 py-4 text-[13px] font-[750] text-[#435a7b]">
                {item} 분석 확장 영역
              </div>
            ))}
          </div>
        </section>

        <RequestDetailModal request={detailRequest} onClose={() => setDetailRequest(null)} />
      </section>
    </OpsShell>
  );
}

