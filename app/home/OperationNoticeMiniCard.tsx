"use client";

import { Megaphone } from "lucide-react";

const notices = [
  "오늘부터 월마감이 시작되었습니다.",
  "6월 세금계산서 마감은 7월 10일까지입니다.",
  "계산서 발행 후 출고 여부를 확인해주세요."
];

export function OperationNoticeMiniCard() {
  return (
    <section className="h-[168px] min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex h-8 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
            <Megaphone size={17} />
          </span>
          <h2 className="truncate text-[16px] font-[950] text-[#111827]">운영 공지</h2>
        </div>
        <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-[11px] font-[900] text-[#64748b]">오늘</span>
      </div>

      <p className="mt-2 truncate text-[12px] font-[750] text-[#64748b]">업무 전 확인해야 할 운영 정보를 안내합니다.</p>

      <ul className="mt-2 max-h-[76px] space-y-1.5 overflow-y-auto pr-1">
        {notices.map((notice) => (
          <li key={notice} className="flex min-w-0 items-start gap-2 text-[12px] font-[800] leading-5 text-[#334155]">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#94a3b8]" />
            <span className="line-clamp-1">{notice}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

