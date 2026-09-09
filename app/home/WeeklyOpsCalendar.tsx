"use client";

import { AlertCircle, Building2, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { weeklyWorkItems, type WorkItem, type WorkItemStatus, type WorkItemType } from "./homeData";

const dayOrder = ["월", "화", "수", "목", "금"];

const typeLabel: Record<WorkItemType, string> = {
  common: "전사 공통",
  monthClose: "월마감",
  collection: "수금",
  request: "요청",
  notice: "공지",
  issue: "자동 이슈"
};

const statusLabel: Record<WorkItemStatus, string> = {
  notStarted: "시작 전",
  inProgress: "진행중",
  needCheck: "확인 필요",
  done: "완료",
  delayed: "지연"
};

function todayLabel() {
  const index = new Date().getDay();
  if (index >= 1 && index <= 5) return dayOrder[index - 1];
  return "월";
}

function statusClass(status: WorkItemStatus, isPast: boolean) {
  if (isPast) return "bg-[#edf4ff] text-[#1D50A2]";
  if (status === "done") return "bg-[#edf4ff] text-[#1D50A2]";
  if (status === "inProgress") return "bg-[#fff5ec] text-[#F39945]";
  if (status === "needCheck") return "bg-[#fff5ec] text-[#F39945]";
  if (status === "delayed") return "bg-[#fff5ec] text-[#F39945]";
  return "bg-[#f1f5f9] text-[#64748b]";
}

function typeClass(type: WorkItemType) {
  if (type === "monthClose" || type === "collection" || type === "request") return "bg-[#edf4ff] text-[#1D50A2]";
  return "bg-[#f1f5f9] text-[#64748b]";
}

function iconFor(item: WorkItem, isPast: boolean) {
  if (isPast || item.status === "done") return CheckCircle2;
  if (item.status === "delayed") return AlertCircle;
  if (item.type === "common") return Building2;
  if (item.type === "monthClose") return CalendarDays;
  return Clock3;
}

function handleWorkItemClick(item: WorkItem) {
  if (item.relatedRoute) {
    window.location.href = item.relatedRoute;
    return;
  }

  window.alert("WR 작성 연결은 준비 중입니다.");
}

export function WeeklyOpsCalendar() {
  const today = todayLabel();
  const todayIndex = dayOrder.indexOf(today);
  const orderedItems = [...weeklyWorkItems].sort((a, b) => {
    const aIndex = dayOrder.indexOf(a.date);
    const bIndex = dayOrder.indexOf(b.date);
    const aDistance = aIndex < todayIndex ? aIndex + 5 - todayIndex : aIndex - todayIndex;
    const bDistance = bIndex < todayIndex ? bIndex + 5 - todayIndex : bIndex - todayIndex;
    return aDistance - bDistance;
  });

  return (
    <section className="min-w-0 overflow-hidden rounded-[22px] border border-[#e9eef6] bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex h-10 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Weekly Work View</p>
          <h2 className="mt-0.5 text-[18px] font-[950] tracking-[-0.03em] text-[#111827]">이번 주 운영 캘린더</h2>
        </div>
        <p className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[11px] font-[900] text-[#64748b]">오늘 {today}요일 먼저 보기</p>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-2.5 min-[1180px]:grid-cols-5">
        {orderedItems.map((item) => {
          const itemIndex = dayOrder.indexOf(item.date);
          const isToday = item.date === today;
          const isPast = itemIndex < todayIndex;
          const Icon = iconFor(item, isPast);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleWorkItemClick(item)}
              className={`flex min-h-[132px] min-w-0 flex-col justify-between overflow-hidden rounded-[18px] border p-3.5 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm ${
                isToday
                  ? "border-[#ef4444] bg-white shadow-[0_8px_18px_rgba(239,68,68,0.12)] ring-1 ring-[#fecaca]"
                  : isPast
                    ? "border-[#edf1f7] bg-[#fbfcff] opacity-70"
                    : "border-[#edf1f7] bg-[#fbfdff] hover:border-[#1D50A2]"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[18px] font-[950] ${isToday ? "text-[#111827]" : "text-[#111827]"}`}>{item.date}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-[900] ${statusClass(item.status, isPast)}`}>
                    {isToday ? "오늘" : isPast ? "완료" : statusLabel[item.status]}
                  </span>
                </div>
                <div className="mt-3 flex min-w-0 items-center gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${typeClass(item.type)}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-[950] text-[#111827]">{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] font-[800] text-[#64748b]">{item.description}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-[900] ${typeClass(item.type)}`}>{typeLabel[item.type]}</span>
                {item.source === "opsData" ? <span className="rounded-full bg-white px-2 py-1 text-[10px] font-[900] text-[#1D50A2]">자동 이슈</span> : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

