"use client";

const metrics = [
  { label: "거래 종료율", value: "68%", color: "text-[#64748b]" },
  { label: "수금률", value: "85%", color: "text-[#1D50A2]" },
  { label: "최근 정확도", value: "97%", color: "text-[#64748b]" }
];

export function PerformanceMiniCard() {
  return (
    <button
      type="button"
      onClick={() => (window.location.href = "/performance")}
      className="h-[168px] min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.032)] transition hover:-translate-y-0.5 hover:border-[#cbd5e1]"
    >
      <div className="flex h-8 items-center justify-between">
        <h2 className="text-[16px] font-[850] text-[#111827]">성과 / 배지</h2>
        <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-[11px] font-[750] text-[#64748b]">바로가기</span>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-3 gap-2">
        {metrics.map((item) => (
          <div key={item.label} className="flex h-[88px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] px-2.5 text-center shadow-[0_4px_10px_rgba(15,23,42,0.02)]">
            <p className="w-full text-[11px] font-[650] leading-[1.25] text-[#64748b]">{item.label}</p>
            <p className={`mt-2 w-full text-[24px] font-[850] leading-none tracking-[-0.01em] ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

