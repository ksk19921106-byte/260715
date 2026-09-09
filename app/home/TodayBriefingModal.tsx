"use client";

import { ArrowRight, CalendarCheck, ClipboardCheck, X } from "lucide-react";
import { routeWithUser } from "../services/globalSearch";
import type { OpsActionItem } from "../services/opsActionSchedule";

function toneClass(tone: OpsActionItem["tone"]) {
  if (tone === "danger") return "border-[#fecaca] bg-[#fff7f7] text-[#dc2626]";
  if (tone === "warning") return "border-[#fed7aa] bg-[#fff8f1] text-[#c9671d]";
  return "border-[#cfe0ff] bg-[#f4f8ff] text-[#1D50A2]";
}

function goToAction(route: string, userName: string) {
  window.location.href = routeWithUser(route, userName);
}

export function TodayBriefingModal({
  userName,
  items,
  onClose,
  onDismissToday
}: {
  userName: string;
  items: OpsActionItem[];
  onClose: () => void;
  onDismissToday: () => void;
}) {
  if (items.length === 0) return null;

  const checkCount = items.filter((item) => item.mode === "check").length;
  const actionCount = items.length - checkCount;
  const onlyChecks = checkCount > 0 && actionCount === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/28 px-4 py-6 backdrop-blur-[2px]">
      <section className="w-full max-w-[620px] overflow-hidden rounded-[28px] border border-[#d9e4f1] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e8eef6] bg-[#f8fbff] px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-[900] uppercase tracking-[0.1em] text-[#F39945]">Today Action</p>
            <h2 className="mt-1 text-[25px] font-[950] tracking-[-0.035em] text-[#111827]">
              {userName}님, 오늘 {onlyChecks ? "점검할" : "처리할"} 업무가 {items.length}건 있어요.
            </h2>
            <p className="mt-2 text-[13px] font-[650] text-[#64748b]">월말과 매월 10일 마감 일정에 맞춘 업무만 안내합니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="팝업 닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#64748b] shadow-sm transition hover:bg-[#eef3f8]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goToAction(item.route, userName)}
              className={`flex w-full min-w-0 items-start gap-4 rounded-[18px] border p-4 text-left shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${toneClass(item.tone)}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                {item.mode === "check" ? <ClipboardCheck size={20} /> : <CalendarCheck size={20} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-[900] shadow-sm">{item.scheduleLabel}</span>
                  <span className="rounded-full border border-current/15 px-2.5 py-1 text-[11px] font-[900]">
                    {item.mode === "check" ? "점검 담당" : "Action Item"}
                  </span>
                </span>
                <span className="mt-2 block text-[15px] font-[900] leading-5 text-[#111827]">{item.title}</span>
                <span className="mt-1 block text-[12px] font-[650] leading-5 text-[#64748b]">{item.description}</span>
              </span>
              <ArrowRight size={17} className="mt-3 shrink-0" />
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8eef6] bg-[#f8fbff] px-6 py-4">
          <button
            type="button"
            onClick={onDismissToday}
            className="h-10 rounded-full border border-[#dce6f3] bg-white px-4 text-[12px] font-[800] text-[#64748b] transition hover:bg-[#f8fafc]"
          >
            오늘 다시 보지 않기
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full border border-[#dce6f3] bg-white px-4 text-[12px] font-[800] text-[#64748b] transition hover:bg-[#f8fafc]"
            >
              나중에 보기
            </button>
            <button
              type="button"
              onClick={() => goToAction(items[0].route, userName)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#F39945] px-5 text-[12px] font-[900] text-white shadow-[0_10px_18px_rgba(243,153,69,0.22)] transition hover:bg-[#d47b2d]"
            >
              {onlyChecks ? "점검 시작하기" : "오늘 업무 시작하기"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
