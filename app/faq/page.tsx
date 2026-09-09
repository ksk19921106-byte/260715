"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, ChevronDown, HelpCircle, Search, ShieldAlert } from "lucide-react";
import { ModulePage } from "@/app/components/ModulePage";

const faqItems = [
  {
    title: "전월 계산서 수정",
    category: "계산서",
    keywords: ["전월", "계산서", "수정", "수정발행"],
    short: "월마감, 매출, 부가세 흐름에 영향이 있어 사전 확인이 필요합니다.",
    body: "기존 계산서 링크, 수정사항, 수정이유를 먼저 정리해주세요. 전월 건은 월마감과 부가세 신고 기준이 흔들릴 수 있어 VIPS팀 확인 후 진행하는 흐름이 안전합니다."
  },
  {
    title: "입금 확인 안 됨",
    category: "수금",
    keywords: ["입금", "수금", "계좌", "입금자명"],
    short: "입금일자, 계좌, 입금자명, 금액이 모두 맞아야 확인됩니다.",
    body: "입금자명이 업체명과 다르면 실제 입금자명을 비고에 남겨주세요. 정보가 하나라도 다르면 미수금 상태가 남거나 거래 종료 처리가 늦어질 수 있습니다."
  },
  {
    title: "카드결제 확인",
    category: "수금",
    keywords: ["카드", "결제", "전표", "카드매출전표"],
    short: "카드매출전표가 있어야 결제 내역을 대조할 수 있습니다.",
    body: "전표가 누락되면 결제 확인, 수금 매칭, 회계 반영이 모두 지연될 수 있습니다. 업체명 또는 고객명과 전표 파일명을 함께 확인해주세요."
  },
  {
    title: "계산서매칭 / 해제",
    category: "매칭",
    keywords: ["계산서매칭", "계산서매칭해제", "트래킹"],
    short: "세금계산서와 거래 흐름을 연결하거나 잘못된 연결을 해제합니다.",
    body: "계산서 링크와 트래킹 URL, 요청 사유를 남겨주세요. 잘못 매칭되면 매출 흐름, 거래 상태, 수금 연결이 모두 어긋날 수 있습니다."
  },
  {
    title: "수금매칭 / 해제",
    category: "매칭",
    keywords: ["수금매칭", "수금매칭해제", "부분입금", "일괄입금"],
    short: "입금 흐름과 거래 또는 세금계산서를 연결합니다.",
    body: "부분입금, 일괄입금, 타업체명 입금은 매칭 기준을 꼭 남겨주세요. 수금 링크, 트래킹 URL, 세금계산서 링크가 있으면 확인이 빨라집니다."
  },
  {
    title: "월마감 미완료",
    category: "월마감",
    keywords: ["월마감", "미완료", "차단", "IKI"],
    short: "월마감 미완료자는 모든 VIPS팀 요청 진입이 제한됩니다.",
    body: "월마감은 별도 요청 화면이 아니라 운영 통제 gateway입니다. IKI에서 미완료 거래를 정리한 뒤 요청 메뉴를 이용해주세요."
  },
  {
    title: "보증보험 계약서 첨부",
    category: "계약",
    keywords: ["보증보험", "계약서", "나라장터", "선금이행"],
    short: "계약서 첨부가 없으면 제출할 수 없습니다.",
    body: "PDF, JPG, JPEG, PNG만 허용됩니다. 계약금액은 VAT 포함 기준으로 입력하고, 계약이행, 하자이행, 선금이행 중 해당 종류를 선택해주세요."
  },
  {
    title: "거래처 정보 변경",
    category: "기준정보",
    keywords: ["거래처", "정보변경", "담당자", "사업자"],
    short: "계산서 발행과 수금 확인 기준이 함께 바뀔 수 있습니다.",
    body: "변경 전후 정보와 적용 시점을 남겨주세요. 거래처 정보가 맞지 않으면 계산서 발행, 수금 매칭, 회계 반영에서 오류가 이어질 수 있습니다."
  }
];

const supportTiles = [
  { title: "자주 찾는 이슈", icon: HelpCircle, body: "전월 수정, 입금확인, 월마감 차단을 빠르게 확인합니다." },
  { title: "운영 리스크", icon: ShieldAlert, body: "왜 막히는지, 어떤 흐름에 영향이 있는지 먼저 봅니다." },
  { title: "실무 가이드", icon: BookOpenCheck, body: "FAQ로 부족하면 교육센터 HOW TO로 이어집니다.", href: "/guide" }
];

const recommended = ["전월 계산서 수정", "입금 확인 안 됨", "월마감 미완료", "계산서매칭", "수금매칭"];

export default function FaqPage() {
  const [query, setQuery] = useState("");
  const [openTitle, setOpenTitle] = useState<string | null>(faqItems[0].title);

  const results = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return faqItems;
    return faqItems.filter((item) => [item.title, item.category, ...item.keywords].some((value) => value.includes(keyword)));
  }, [query]);

  return (
    <ModulePage
      eyebrow="Search / FAQ"
      title="검색하기 / FAQ"
      description="짧게 찾고, 필요한 답변만 펼쳐봅니다. VIPS팀 요청 전 자주 막히는 지점을 모았습니다."
    >
      <div className="mt-6 grid grid-cols-3 gap-3">
        {supportTiles.map((tile) => (
          <a
            key={tile.title}
            href={tile.href ?? "#faq-list"}
            className="rounded-[22px] border border-[#e7ecf4] bg-[#fbfdff] p-4 transition hover:border-[#b9cff1] hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#1D50A2]">
                <tile.icon size={21} />
              </div>
              <ArrowRight size={16} className="text-[#8a9bb4]" />
            </div>
            <p className="mt-3 text-[14px] font-[900] text-[#10203f]">{tile.title}</p>
            <p className="mt-1 text-[12px] font-[650] leading-5 text-[#5b6b84]">{tile.body}</p>
          </a>
        ))}
      </div>

      <div className="mt-5 rounded-[24px] border border-[#e7ecf4] bg-white p-4 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
        <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#dce6f3] bg-[#fbfdff] px-4">
          <Search size={18} className="text-[#1D50A2]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예: 전월 계산서 수정, 입금 확인 안 됨, 월마감 미완료"
            className="h-full flex-1 bg-transparent text-[14px] font-[700] text-[#10203f] outline-none placeholder:text-[#8a9bb4]"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {recommended.map((item) => (
            <button
              key={item}
              onClick={() => setQuery(item)}
              className="rounded-full bg-[#edf4ff] px-3 py-1.5 text-[12px] font-[850] text-[#1D50A2] transition hover:bg-[#dceaff]"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div id="faq-list" className="mt-4 overflow-hidden rounded-[24px] border border-[#e7ecf4] bg-white shadow-[0_10px_26px_rgba(21,31,53,0.04)]">
        {results.map((item) => {
          const open = openTitle === item.title;
          return (
            <section key={item.title} className="border-t border-[#eef3fa] first:border-t-0">
              <button
                onClick={() => setOpenTitle(open ? null : item.title)}
                className="grid w-full grid-cols-[96px_1fr_26px] items-center gap-3 bg-white px-5 py-4 text-left transition hover:bg-[#fbfdff]"
              >
                <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-center text-[11px] font-[850] text-[#5b6b84]">{item.category}</span>
                <span>
                  <span className="block text-[15px] font-[900] text-[#10203f]">{item.title}</span>
                  <span className="mt-1 block text-[12px] font-[650] leading-5 text-[#5b6b84]">{item.short}</span>
                </span>
                <ChevronDown size={18} className={`text-[#1D50A2] transition ${open ? "rotate-180" : ""}`} />
              </button>
              {open && <p className="border-t border-[#eef3fa] bg-[#f8fbff] px-5 py-4 text-[13px] font-[700] leading-6 text-[#435a7b]">{item.body}</p>}
            </section>
          );
        })}
        {results.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] font-[750] text-[#5b6b84]">검색 결과가 없습니다. 키워드를 조금 짧게 입력해보세요.</div>
        )}
      </div>
    </ModulePage>
  );
}

