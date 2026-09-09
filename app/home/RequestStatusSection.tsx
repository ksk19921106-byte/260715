"use client";

import { useEffect, useMemo, useState } from "react";
import { TEST_USERS, useSelectedUser } from "../hooks/useSelectedUser";
import type { RequestItem, RequestStatus } from "../services/requestStorage";

const statusStyles = {
  received: { label: "접수", color: "text-[#64748b]", bg: "bg-[#f1f5f9]" },
  processing: { label: "처리중", color: "text-[#F39945]", bg: "bg-[#fff5ec]" },
  done: { label: "완료", color: "text-[#1D50A2]", bg: "bg-[#edf4ff]" },
  rejected: { label: "반려", color: "text-[#F39945]", bg: "bg-[#fff5ec]" }
};

type RequestBucket = keyof typeof statusStyles;

function goRequestStatus() {
  const params = new URLSearchParams(window.location.search);
  const user = params.get("user");
  window.location.href = `/request-status${user ? `?user=${encodeURIComponent(user)}` : ""}`;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function findUserByIdentity(value: string) {
  const key = normalize(value);
  return TEST_USERS.find((user) => normalize(user.name) === key || normalize(user.email) === key || normalize(user.salesName) === key);
}

function requestBucket(status: RequestStatus | string | undefined): RequestBucket {
  const value = String(status ?? "");
  if (value.includes("반려") || value.toLowerCase().includes("reject")) return "rejected";
  if (value.includes("완료") || value.toLowerCase().includes("done") || value.toLowerCase().includes("complete")) return "done";
  if (value.includes("확인") || value.includes("처리") || value.toLowerCase().includes("process")) return "processing";
  return "received";
}

function requesterMatches(item: RequestItem, user: { name: string; email: string; salesName: string }) {
  const requester = normalize(item.requester);
  const requesterUser = findUserByIdentity(item.requester);
  return (
    requester === normalize(user.name) ||
    requester === normalize(user.email) ||
    requester === normalize(user.salesName) ||
    normalize(requesterUser?.name) === normalize(user.name) ||
    normalize(requesterUser?.email) === normalize(user.email) ||
    normalize(requesterUser?.salesName) === normalize(user.salesName)
  );
}

function assignedMatches(item: RequestItem, user: { name: string; email: string; salesName: string }) {
  const owners = item.assignedOwners ?? [];
  return owners.some((owner) => {
    const ownerUser = findUserByIdentity(owner);
    return (
      normalize(owner) === normalize(user.name) ||
      normalize(owner) === normalize(user.email) ||
      normalize(owner) === normalize(user.salesName) ||
      normalize(ownerUser?.name) === normalize(user.name) ||
      normalize(ownerUser?.email) === normalize(user.email) ||
      normalize(ownerUser?.salesName) === normalize(user.salesName)
    );
  });
}

function isVipsAssigneeUser(userName: string) {
  return ["sally", "gavin", "vincent"].includes(normalize(userName));
}

export function RequestStatusSection({
  onDelayedTaskCountChange
}: {
  onDelayedTaskCountChange?: (count: number) => void;
}) {
  const { selectedUser } = useSelectedUser();
  const [requests, setRequests] = useState<RequestItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/requests", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { items?: RequestItem[] } | null) => {
        if (!isMounted) return;
        setRequests(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (isMounted) setRequests([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleRequests = useMemo(() => {
    if (isVipsAssigneeUser(selectedUser.name)) {
      return requests.filter((item) => assignedMatches(item, selectedUser));
    }

    return requests.filter((item) => requesterMatches(item, selectedUser) || assignedMatches(item, selectedUser));
  }, [requests, selectedUser]);

  const counts = useMemo(() => {
    const next: Record<RequestBucket, number> = {
      received: 0,
      processing: 0,
      done: 0,
      rejected: 0
    };
    visibleRequests.forEach((item) => {
      next[requestBucket(item.status)] += 1;
    });
    return next;
  }, [visibleRequests]);

  useEffect(() => {
    onDelayedTaskCountChange?.(counts.rejected > 0 ? 1 : 0);
  }, [counts.rejected, onDelayedTaskCountChange]);

  const statusItems = [
    { ...statusStyles.received, value: counts.received },
    { ...statusStyles.processing, value: counts.processing },
    { ...statusStyles.done, value: counts.done },
    { ...statusStyles.rejected, value: counts.rejected }
  ];

  return (
    <button
      type="button"
      onClick={goRequestStatus}
      className="h-[204px] min-w-0 cursor-pointer overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.032)] transition hover:border-[#cfe0ff] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="flex h-8 items-center justify-between">
        <div>
          <h2 className="text-[16px] font-[950] text-[#111827]">나의 요청현황</h2>
          <p className="mt-0.5 text-[11px] font-[750] text-[#64748b]">요청 상태를 한눈에 확인합니다.</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e9eef6] bg-[#f8fbff] text-[15px] font-[950] text-[#1D50A2] shadow-sm">
          →
        </span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-4 gap-2.5">
        {statusItems.map((item) => (
          <div key={item.label} className="flex h-[106px] min-w-0 flex-col items-start justify-center gap-2 overflow-hidden rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] px-3.5 shadow-[0_4px_10px_rgba(15,23,42,0.022)]">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.bg}`} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-[850] text-[#64748b]">{item.label}</p>
              <p className={`mt-1 truncate text-[26px] font-[950] leading-none ${item.color}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}
