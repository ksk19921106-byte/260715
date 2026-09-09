"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  FileCheck2,
  FileText,
  Landmark,
  Link2,
  MessageCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import { BlockedGateDialog } from "../components/BlockedGateDialog";
import { ModulePage } from "@/app/components/ModulePage";
import { useSelectedUser } from "../hooks/useSelectedUser";
import { checkMonthEndGate } from "../services/monthEndGate";
import { REQUEST_FORM_CONFIGS, type RequestKind } from "../services/formValidation";

const requestCards: Array<{
  kind: RequestKind;
  group: "전체" | "계산서" | "수금" | "계약" | "월마감";
  icon: LucideIcon;
  summary: string;
  chips: string[];
}> = [
  { kind: "taxInvoice", group: "계산서", icon: FileText, summary: "품목, 수량, 단가를 기준으로 공급가액과 VAT를 계산합니다.", chips: ["세금계산서", "VAT", "트래킹"] },
  { kind: "revisedTaxInvoice", group: "계산서", icon: RotateCcw, summary: "전월 계산서 수정은 월마감과 부가세 흐름을 먼저 확인합니다.", chips: ["수정발행", "전월수정", "팝업확인"] },
  { kind: "reverseIssueApproval", group: "계산서", icon: ShieldCheck, summary: "역발행 사이트, 최종금액, 건수를 정리해 승인 요청합니다.", chips: ["역발행", "승인", "금액"] },
  { kind: "advancePayment", group: "수금", icon: Landmark, summary: "선수금 일부사용/전부소진 처리에 필요한 IKI 링크와 금액 기준을 남깁니다.", chips: ["선수금", "IKI Tax ID", "ERP처리"] },
  { kind: "cardPayment", group: "수금", icon: CreditCard, summary: "카드전표 첨부를 기준으로 카드결제 확인을 요청합니다.", chips: ["카드전표", "첨부필수", "수금"] },
  { kind: "guaranteeInsurance", group: "계약", icon: BadgeCheck, summary: "계약서와 계약금액 기준으로 보증보험 요청을 진행합니다.", chips: ["계약", "보증보험", "VAT포함"] },
  { kind: "invoiceMatching", group: "계산서", icon: Link2, summary: "계산서와 트래킹 흐름을 연결하거나 해제합니다.", chips: ["매칭", "해제", "트래킹"] },
  { kind: "collectionMatching", group: "수금", icon: Landmark, summary: "입금, 계산서, 트래킹 흐름을 연결하거나 해제합니다.", chips: ["수금매칭", "입금매칭", "해제"] },
  { kind: "monthEndCheck", group: "월마감", icon: FileCheck2, summary: "IKI 월마감 확인 후 VIPS 요청 가능 여부를 점검합니다.", chips: ["Gatekeeper", "월마감", "통제"] }
];

const groups = ["전체", "계산서", "수금", "계약", "월마감"] as const;

const helpCards = [
  { title: "요청 전 먼저 확인하세요", body: "월마감, 수금, 계산서 흐름이 막혀 있으면 요청이 반려될 수 있습니다.", icon: Search },
  { title: "월마감 미완료 시 제한", body: "미종료 거래가 남아 있으면 VIPS팀 요청 진입이 제한됩니다.", icon: ShieldCheck },
  { title: "VIPS팀에 정확히 전달", body: "필수값과 첨부파일을 함께 남기면 처리 시간이 줄어듭니다.", icon: MessageCircle }
];

export default function RequestsPage() {
  const { selectedUser } = useSelectedUser();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<(typeof groups)[number]>("전체");

  useEffect(() => {
    if (selectedUser.accessRole === "admin") {
      setIsBlocked(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    checkMonthEndGate(selectedUser.name)
      .then((result) => setIsBlocked(result.isBlocked))
      .catch(() => setIsBlocked(false))
      .finally(() => setLoading(false));
  }, [selectedUser.accessRole, selectedUser.name]);

  const visibleCards = useMemo(() => {
    const keyword = query.trim();
    return requestCards.filter((item) => {
      const config = REQUEST_FORM_CONFIGS[item.kind];
      const inGroup = activeGroup === "전체" || item.group === activeGroup;
      const inSearch = !keyword || [config.title, item.group, item.summary, ...item.chips].some((value) => value.includes(keyword));
      return inGroup && inSearch;
    });
  }, [activeGroup, query]);

  if (isBlocked) {
    return (
      <ModulePage
        eyebrow="Month-End Gatekeeper"
        title="VIPS팀 요청 제한"
        description="미종료 거래가 남아 있으면 VIPS팀 요청 기능을 사용할 수 없습니다."
      >
        <div className="mt-6 rounded-[20px] border border-[rgba(243,153,69,0.30)] bg-[#fff5ec] px-5 py-8 text-center text-[14px] font-[750] leading-6 text-[#435a7b]">
          미종료 거래가 남아 있어 VIPS팀 요청 진입이 불가합니다.
        </div>
        <BlockedGateDialog open={true} onClose={() => window.history.back()} />
      </ModulePage>
    );
  }

  return (
    <ModulePage
      eyebrow="VIPS Requests"
      title="VIPS팀 요청"
      description="필요한 요청을 검색하거나 카테고리로 고르면 전용 Form으로 이동합니다."
    >
      <section className="ops-card mt-5 overflow-hidden bg-[#fbfcff]">
        <div className="grid grid-cols-[1.1fr_0.9fr] gap-4 px-5 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="ops-icon-circle">
                <Sparkles size={20} />
              </span>
              <p className="text-[12px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Request Support Center</p>
            </div>
            <h2 className="mt-3 text-[26px] font-[950] tracking-[-0.025em] text-[#111827]">무슨 요청이 필요하세요?</h2>
            <p className="mt-2 text-[13px] font-[700] leading-5 text-[#64748b]">
              전자부품 유통 SALES 흐름에 맞춰 계산서, 수금, 매칭, 월마감 요청을 빠르게 찾습니다.
            </p>
            <div className="mt-5 flex h-12 items-center gap-3 rounded-[16px] border border-[#e5eaf3] bg-white px-4 shadow-sm">
              <Search size={19} className="text-[#1D50A2]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="전월 수정, 선수금, 카드전표, 수금매칭"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-[750] text-[#10203f] outline-none placeholder:text-[#8a9bb4]"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {helpCards.map((card) => (
              <article key={card.title} className="flex items-center gap-3 rounded-[16px] border border-[#edf1f6] bg-white px-4 py-3 shadow-sm">
                <span className="ops-icon-circle shrink-0">
                  <card.icon size={20} />
                </span>
                <span>
                  <span className="block text-[13px] font-[900] text-[#111827]">{card.title}</span>
                  <span className="mt-0.5 block text-[12px] font-[700] leading-5 text-[#64748b]">{card.body}</span>
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {groups.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => setActiveGroup(group)}
            className={`h-10 rounded-full px-4 text-[13px] font-[900] transition ${
              activeGroup === group ? "bg-[#1D50A2] text-white shadow-sm" : "border border-[#e5eaf3] bg-white text-[#64748b] hover:bg-[#f8fbff]"
            }`}
          >
            {group}
          </button>
        ))}
      </div>

      <div data-request-menu-list="true" className="mt-4 grid grid-cols-3 gap-4">
        {visibleCards.map((item) => {
          const config = REQUEST_FORM_CONFIGS[item.kind];
          return (
            <a
              key={item.kind}
              href={`/requests/${item.kind}?user=${encodeURIComponent(selectedUser.name)}`}
              className="ops-card group p-4 text-left transition hover:-translate-y-0.5 hover:border-[#cbdaf5]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="ops-icon-circle">
                  <item.icon size={24} />
                </div>
                <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-[11px] font-[850] text-[#5b6b84]">{item.group}</span>
              </div>
              <h2 className="mt-4 text-[17px] font-[950] tracking-[-0.01em] text-[#111827]">{config.title}</h2>
              <p className="mt-2 min-h-[40px] text-[13px] font-[700] leading-5 text-[#64748b]">{item.summary}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.chips.map((chip) => (
                  <span key={chip} className="rounded-full border border-[#e7ecf4] bg-[#fbfdff] px-2.5 py-1 text-[11px] font-[850] text-[#435a7b]">
                    {chip}
                  </span>
                ))}
              </div>
              <div className="ops-btn-primary mt-5 flex h-10 items-center justify-between px-4 text-[13px] transition group-hover:bg-[#1d4ed8]">
                작성하기
                <ArrowRight size={16} />
              </div>
            </a>
          );
        })}
      </div>

      {visibleCards.length === 0 && (
        <div className="mt-4 rounded-[22px] border border-[#e7ecf4] bg-[#fbfdff] px-5 py-10 text-center text-[13px] font-[750] text-[#5b6b84]">
          검색 결과가 없습니다. 키워드를 조금 짧게 입력해보세요.
        </div>
      )}

      <div className="mt-5 rounded-[18px] border border-[#dce6f3] bg-[#fbfdff] px-4 py-3 text-[12px] font-[750] leading-5 text-[#435a7b]">
        월마감 미완료 시 VIPS팀 요청 진입이 제한됩니다. 요청 전 미종료 거래를 먼저 확인해주세요.
      </div>
    </ModulePage>
  );
}
