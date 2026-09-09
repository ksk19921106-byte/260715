"use client";

import { AlertTriangle, CalendarCheck, ClipboardList, WalletCards } from "lucide-react";
import { summary } from "./homeData";

const kpis = [
  { label: "오늘 할 일", value: `${summary.totalNeedCheckCount}건`, color: "text-[#F39945]", bg: "bg-[#fff5ec]", icon: ClipboardList },
  { label: "월마감 이슈", value: `${summary.monthlyNeedCount}건`, color: "text-[#F39945]", bg: "bg-[#fff4e8]", icon: CalendarCheck },
  { label: "수금 이슈", value: `${summary.collectionNeedCount}건`, color: "text-[#1D50A2]", bg: "bg-[#edf4ff]", icon: WalletCards },
  { label: "반려/지연", value: `${summary.delayedRequestCount}건`, color: "text-[#F39945]", bg: "bg-[#fff5ec]", icon: AlertTriangle }
];

export function SummaryKpiStrip() {
  return (
    <div className="grid min-w-0 grid-cols-4 overflow-hidden rounded-[18px] border border-[#e5eaf3] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
      {kpis.map((item, index) => (
        <div key={item.label} className={`min-w-0 px-3 first:pl-0 ${index > 0 ? "border-l border-[#e5eaf3]" : ""}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.bg}`}>
              <item.icon size={16} className={item.color} />
            </span>
            <div className="min-w-0">
              <p className="mb-1 truncate text-[11px] font-[850] text-[#64748b]">{item.label}</p>
              <p className={`truncate text-[24px] font-[900] leading-none tracking-[-0.03em] ${item.color}`}>{item.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

