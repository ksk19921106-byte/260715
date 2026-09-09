"use client";

import type { RequestKind } from "../services/formValidation";
import { quickRequests } from "./homeData";

export function QuickRequestSection({ onSelectRequestKind }: { onSelectRequestKind: (kind: RequestKind) => void }) {
  return (
    <section className="h-[204px] min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex h-8 items-center justify-between">
        <div>
          <h2 className="text-[16px] font-[950] text-[#111827]">VIPS팀 요청 바로가기</h2>
          <p className="mt-0.5 text-[11px] font-[750] text-[#64748b]">필요한 요청만 빠르게 시작합니다.</p>
        </div>
        <button onClick={() => (window.location.href = "/requests")} className="h-8 rounded-full border border-[#e9eef6] bg-[#f8fbff] px-3 text-[11px] font-[900] text-[#1D50A2]">
          전체 메뉴
        </button>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-3 gap-2.5">
        {quickRequests.slice(0, 3).map((item) => (
          <button
            key={item.kind}
            onClick={() => onSelectRequestKind(item.kind)}
            className="flex h-[106px] min-w-0 flex-col items-start justify-center gap-2 overflow-hidden rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] px-3.5 text-left shadow-[0_4px_10px_rgba(15,23,42,0.022)] transition hover:-translate-y-0.5 hover:border-[#cbd5e1]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf4ff] text-[#1D50A2]">
              <item.icon size={18} />
            </span>
            <span className="min-w-0 whitespace-pre-line text-[12px] font-[900] leading-[15px] text-[#111827]">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

