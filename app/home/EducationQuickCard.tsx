"use client";

export function EducationQuickCard() {
  return (
    <section className="h-[150px] min-w-0 overflow-hidden rounded-[20px] border border-[#e5eaf3] bg-white p-[18px] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <h2 className="text-[18px] font-[950] text-[#111827]">교육센터</h2>
      <p className="mt-2 truncate text-[13px] font-[750] text-[#64748b]">실무가이드, 거래흐름, FAQ, 사고사례를 한 곳에서 확인하세요.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["실무가이드", "거래흐름", "FAQ", "사고사례"].map((chip) => (
          <span key={chip} className="rounded-full bg-[#f3f6fb] px-3 py-1 text-[11px] font-[850] text-[#475569]">{chip}</span>
        ))}
      </div>
      <button onClick={() => (window.location.href = "/guide")} className="mt-3 rounded-xl bg-[#edf4ff] px-4 py-2 text-[12px] font-[900] text-[#1D50A2]">교육센터 이동</button>
    </section>
  );
}

