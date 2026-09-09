"use client";

import { BookOpenCheck } from "lucide-react";

const dailyTaxTips = [
  {
    title: "부가세 신고는 왜 하나요?",
    category: "부가세",
    summary: "회사가 받은 부가세와 낸 부가세를 정리해 국가에 신고하는 절차입니다.",
    point: "계산서 발행월이 틀리면 신고 기준도 흔들릴 수 있어요.",
    keyword: "부가세 신고"
  },
  {
    title: "1기와 2기 과세기간",
    category: "신고기간",
    summary: "부가세는 보통 1기(1~6월), 2기(7~12월) 흐름으로 관리합니다.",
    point: "마감월 계산서를 수정할 때는 어느 과세기간인지 먼저 봐야 합니다.",
    keyword: "부가세 신고기간"
  },
  {
    title: "수정세금계산서가 늦으면 왜 위험할까요?",
    category: "수정발행",
    summary: "신고가 끝난 기간의 계산서는 수정 영향이 커져 확인 절차가 늘어납니다.",
    point: "전월 또는 전분기 건은 VIPS 확인 후 요청하는 게 안전합니다.",
    keyword: "수정세금계산서"
  },
  {
    title: "공급가액과 부가세는 따로 봅니다",
    category: "계산서 금액",
    summary: "합계액만 맞아도 공급가액과 부가세가 다르면 반려될 수 있습니다.",
    point: "요청 전 공급가액, 부가세, 합계액을 각각 확인하세요.",
    keyword: "공급가액"
  },
  {
    title: "부분입금은 완료가 아닙니다",
    category: "AR",
    summary: "입금이 일부만 들어오면 남은 차액은 AR로 계속 남습니다.",
    point: "차액이 0원이 될 때까지 수금매칭과 잔액 사유를 확인해야 합니다.",
    keyword: "부분입금"
  },
  {
    title: "월마감은 거래 종료 확인입니다",
    category: "월마감",
    summary: "출고, 계산서, 수금 흐름이 맞아야 거래가 닫힙니다.",
    point: "출고만 끝났다고 거래가 종료된 것은 아닙니다.",
    keyword: "월마감"
  }
];

function getDailyTipIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return dayOfYear % dailyTaxTips.length;
}

export function DailyTaxTipMiniCard() {
  const tip = dailyTaxTips[getDailyTipIndex()];

  return (
    <button
      type="button"
      onClick={() => (window.location.href = `/guide?query=${encodeURIComponent(tip.keyword)}`)}
      className="h-[168px] min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.032)] transition hover:-translate-y-0.5 hover:border-[#cbd5e1]"
    >
      <div className="flex h-8 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#1D50A2]">
            <BookOpenCheck size={16} />
          </span>
          <h2 className="truncate text-[16px] font-[850] text-[#111827]">오늘의 세무·재무 팁</h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#f8fbff] px-3 py-1 text-[11px] font-[750] text-[#64748b]">자동 교육</span>
      </div>

      <div className="mt-3 min-w-0">
        <span className="inline-flex rounded-full bg-[#fff5ec] px-2.5 py-1 text-[10px] font-[900] text-[#F39945]">{tip.category}</span>
        <p className="mt-2 line-clamp-1 text-[15px] font-[950] tracking-[-0.02em] text-[#111827]">{tip.title}</p>
        <p className="mt-1 line-clamp-2 text-[12px] font-[750] leading-[1.45] text-[#64748b]">{tip.summary}</p>
        <p className="mt-2 line-clamp-1 text-[12px] font-[850] text-[#1D50A2]">{tip.point}</p>
      </div>
    </button>
  );
}
