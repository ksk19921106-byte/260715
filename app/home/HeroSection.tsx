"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { routeWithUser } from "../services/globalSearch";

export function HeroSection({ userName, taskCount, actionRoute }: { userName: string; taskCount: number; actionRoute?: string }) {
  return (
    <section className="relative min-h-[206px] min-w-0 overflow-hidden rounded-[20px] border border-[#cbd5e1] bg-[linear-gradient(135deg,#fff7f3_0%,#ffffff_52%,#edf4ff_100%)] shadow-[0_12px_28px_rgba(15,23,42,0.085)] ring-1 ring-[#dbe4f0]">
      <div className="relative z-20 flex min-h-[206px] min-w-0 flex-col justify-center px-8 py-7 min-[1080px]:pr-[330px]">
        <p className="truncate text-[18px] font-[900] text-[#111827]">{userName}님 👋</p>
        <h1 className="mt-1 text-[30px] font-[950] leading-[1.08] tracking-[-0.035em] text-[#111827] min-[1280px]:text-[38px]">
          오늘 확인할 업무 <span className="text-[#F39945]">{taskCount.toLocaleString("ko-KR")}건</span>
        </h1>
        <p className="mt-2 text-[13px] font-[750] text-[#64748b]">월말과 매월 10일 마감 Action Item을 확인하세요.</p>
      </div>

      <div className="hero-visual absolute inset-y-0 right-0 z-10 hidden w-[320px] min-w-0 overflow-hidden min-[1080px]:block">
        <Image
          src="/assets/mascots/hero-target.png"
          alt="오늘 업무 목표"
          width={210}
          height={210}
          className="absolute right-[20px] top-[20px] z-10 max-h-[154px] max-w-[154px] object-contain opacity-55 drop-shadow-[0_12px_22px_rgba(239,68,68,0.10)]"
          priority
        />
        <Image
          src="/assets/brand/bandol-full.png"
          alt="ICBANQ OPS 마스코트"
          width={285}
          height={285}
          className="absolute bottom-[-24px] left-[-8px] z-20 max-h-[244px] max-w-[244px] object-contain drop-shadow-[0_12px_18px_rgba(15,23,42,0.16)]"
          priority
        />
      </div>

      <a
        href={actionRoute ?? "/month-end"}
        onClick={(event) => {
          event.preventDefault();
          window.location.href = routeWithUser(actionRoute ?? "/month-end", userName);
        }}
        aria-label="오늘 업무 시작하기"
        className="absolute bottom-[18px] right-[18px] z-40 inline-flex h-[38px] items-center gap-1.5 rounded-full bg-[#F39945] px-4 text-[12px] font-[950] text-white shadow-[0_10px_20px_rgba(239,68,68,0.24)] transition hover:bg-[#b85f18]"
      >
        오늘 업무 시작하기
        <ArrowRight size={14} />
      </a>
    </section>
  );
}

