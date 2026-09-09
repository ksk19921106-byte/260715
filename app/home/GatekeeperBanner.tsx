"use client";

import { AlertTriangle } from "lucide-react";

export function GatekeeperBanner() {
  return (
    <section className="flex h-[48px] w-full max-w-[420px] min-w-0 items-center overflow-hidden rounded-[16px] border border-[#fecaca] bg-[#fff5ec] px-3 shadow-[0_8px_18px_rgba(239,68,68,0.055)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#F39945] shadow-sm">
          <AlertTriangle size={15} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-[950] text-[#111827]">월마감 미완료시 요청이 불가합니다.</p>
          <p className="mt-0.5 truncate text-[10px] font-[750] text-[#64748b]">요청 전 종료되지 않은 거래를 먼저 확인해주세요.</p>
        </div>
      </div>
    </section>
  );
}

