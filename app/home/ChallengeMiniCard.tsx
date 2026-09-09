"use client";

import Image from "next/image";

const DALBAENG_CHALLENGE_URL = "https://script.google.com/macros/s/AKfycbxP-bK6z-aWZtNrBF-he1ljukZ_mMFZvK_Ejce98vvFur3pfnx5rxOX8_2KT_N2LQ4GpQ/exec";
const BOOKBAENG_TEAMS_URL = "https://teams.microsoft.com/l/chat/19:88655096fbd943189e74fc222f276f15@thread.v2/conversations?context=%7B%22contextType%22%3A%22chat%22%7D";

export function ChallengeMiniCard() {
  return (
    <section className="h-[150px] min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex h-8 items-center justify-between">
        <h2 className="text-[16px] font-[950] text-[#111827]">달뱅 / 북뱅</h2>
        <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-[11px] font-[900] text-[#64748b]">이벤트</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={DALBAENG_CHALLENGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[86px] items-center gap-2 rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] px-3 shadow-[0_4px_10px_rgba(15,23,42,0.02)] transition hover:border-[#cbd5e1]"
        >
          <span className="relative h-[58px] w-[58px] shrink-0">
            <Image src="/assets/brand/bandol-full.png" alt="달뱅 챌린지" fill sizes="58px" className="object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-[950] text-[#111827]">달뱅</span>
            <span className="block truncate text-[11px] font-[750] text-[#64748b]">운동 캠페인</span>
          </span>
        </a>
        <a
          href={BOOKBAENG_TEAMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[86px] items-center gap-2 rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] px-3 shadow-[0_4px_10px_rgba(15,23,42,0.02)] transition hover:border-[#cbd5e1]"
        >
          <span className="relative h-[58px] w-[58px] shrink-0">
            <Image src="/assets/brand/bansoon-full.png" alt="북뱅 챌린지" fill sizes="58px" className="object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-[950] text-[#111827]">북뱅</span>
            <span className="block truncate text-[11px] font-[750] text-[#64748b]">독서 캠페인</span>
          </span>
        </a>
      </div>
    </section>
  );
}

