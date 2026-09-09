"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  AlertTriangle,
  Banknote,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Landmark,
  MessageSquare,
  PackageCheck,
  PlusCircle,
  Search,
  ShieldCheck,
  Truck,
  UserRound
} from "lucide-react";
import { BlockedGateDialog } from "./components/BlockedGateDialog";
import { Home } from "./home/Home";
import { OpsShell } from "./components/OpsShell";
import { RequestDetailModal } from "./components/RequestDetailModal";
import { getTestUser, useSelectedUser } from "./hooks/useSelectedUser";
import {
  REQUEST_FORM_CONFIGS,
  initialRequestFormValues,
  validateRequestForm,
  type RequestFormField,
  type RequestFormValues,
  type RequestKind
} from "./services/formValidation";
import { checkMonthEndGate } from "./services/monthEndGate";
import { fetchRequests, saveRequest, type RequestItem, type RequestStatus } from "./services/requestStorage";
import { buildTradeCloseSummary, emptyTradeCloseSummary, fetchTradeCloseDashboard, getTradeCloseSummaryForUser, type TradeCloseRecord, type TradeCloseUserSummary } from "./services/tradeClose";
import seedTradeCloseRecords from "../data/trade-close-records.json";

type ViewMode = "dashboard" | "requestForm";
type DialogType = "taxPrecheck" | "revisionPrecheck" | "missing" | "success" | null;
type ExchangeRatePoint = {
  date: string;
  baseDate?: string;
  rate: number;
};

const requestKinds: RequestKind[] = [
  "taxInvoice",
  "revisedTaxInvoice",
  "reverseIssueApproval",
  "advancePayment",
  "cardPayment",
  "guaranteeInsurance",
  "invoiceMatching",
  "collectionMatching",
  "monthEndCheck"
];

const fallbackExchangeRates: ExchangeRatePoint[] = [
  { date: "06/24", baseDate: "2026-06-24", rate: 1547.48 }
];

const monthlyCloseStatus = {
  invoiceRequiredCount: 3,
  invoiceRequiredAmount: 79895946,
  shipmentCheckCount: 2,
  shipmentCheckAmount: 5252933,
  longPendingCount: 1,
  longPendingAmount: 75000,
  deductCheckCount: 0,
  deductCheckAmount: 0
};

const collectionStatus = {
  collectionCheckCount: 1,
  collectionCheckAmount: 1429024,
  collectionMatchingPendingCount: 2,
  paymentMatchingErrorCount: 1
};

const actionSummary = {
  totalNeedCheckCount: 7,
  totalNeedCheckAmount: 86577903
};

const initialTradeCloseDashboard = buildTradeCloseSummary(seedTradeCloseRecords as TradeCloseRecord[]);

const kpis = [
  { label: "이번달 요청 처리", value: "42건", sub: "VIPS팀 접수 기준", delta: "▲ 8건" },
  { label: "반려 없는 요청", value: "11일", sub: "streak 유지 중", delta: "좋은 흐름" },
  { label: "월마감 완료", value: "3회", sub: "연속 완료 기록", delta: "완료" },
  { label: "최근 처리 정확도", value: "97%", sub: "보완/반려 제외", delta: "▲ 12%p" }
];

const tasks = [
  { title: "수정세금계산서 재확인", body: "전월 건 2건 · 신고 영향 확인", count: 2, icon: FileText, tone: "rose" },
  { title: "카드전표 누락 보완", body: "증빙 없으면 수금매칭 지연", count: 1, icon: CreditCard, tone: "blue" },
  { title: "수금매칭 보류 점검", body: "부분입금/타업체명 입금 확인", count: 2, icon: Banknote, tone: "green" },
  { title: "월마감 전 출고 흐름 확인", body: "출고 완료 후 계산서 미발행 방지", count: 1, icon: CalendarCheck, tone: "amber" }
];

const searchKeywords = ["계산서매칭", "수금매칭", "입금 매칭 오류"];
const homeSearchItems = [
  {
    title: "계산서매칭",
    keywords: ["계산서매칭", "계산서", "트래킹", "거래 흐름 연결"],
    body: "계산서매칭은 세금계산서와 트래킹 흐름을 연결해 출고/매출/수금 흐름을 맞추는 요청입니다. 계산서 링크와 트래킹 링크를 함께 남겨 주세요."
  },
  {
    title: "계산서매칭해제",
    keywords: ["계산서매칭해제", "계산서 연결 오류", "매칭해제"],
    body: "계산서가 잘못 연결된 경우 계산서매칭해제로 요청합니다. 잘못 연결된 계산서 링크와 트래킹 링크, 해제 사유가 필요합니다."
  },
  {
    title: "수금매칭",
    keywords: ["수금매칭", "입금", "수금", "거래 흐름 연결"],
    body: "수금매칭은 입금/수금 정보와 트래킹 또는 세금계산서 흐름을 연결하는 요청입니다. 수금 링크와 연결 대상 링크를 함께 입력해 주세요."
  },
  {
    title: "수금매칭해제",
    keywords: ["수금매칭해제", "입금 매칭 오류", "수금 오류"],
    body: "입금 또는 수금이 잘못 연결된 경우 수금매칭해제로 접수합니다. 수금 링크, 연결된 트래킹 또는 세금계산서 링크, 해제 사유가 필요합니다."
  },
  {
    title: "전월 계산서 수정",
    keywords: ["전월", "계산서", "수정", "수정발행"],
    body: "전월 계산서 수정은 원 계산서 번호와 수정 사유 확인이 먼저 필요합니다. 발행월이 바뀌면 월마감과 매출 흐름에 영향이 있으므로 IKI 거래 상태를 먼저 확인해주세요."
  },
  {
    title: "입금 확인 안됨",
    keywords: ["입금", "확인", "수금"],
    body: "입금 확인 요청에는 입금일자, 입금계좌, 입금자명, 입금금액이 함께 필요합니다. 입금자명이 업체명과 다르면 비고에 실제 입금자명을 적어주세요."
  },
  {
    title: "계산서 누락",
    keywords: ["계산서", "누락", "출고"],
    body: "출고는 완료되었지만 계산서가 발행되지 않은 경우 월 매출 누락과 수금 지연으로 이어질 수 있습니다. IKI에서 출고O / 계산서X 상태를 먼저 확인해주세요."
  },
  {
    title: "카드결제 확인",
    keywords: ["카드", "결제", "매출전표"],
    body: "카드결제 확인은 결제일자, 결제금액, 카드 매출전표가 있어야 처리할 수 있습니다. 매출전표 파일명은 요청 상세에 기록됩니다."
  },
  {
    title: "수정발행 기준",
    keywords: ["수정발행", "수정", "기준"],
    body: "수정발행은 금액, 거래처 정보, 발행월, 품목 변경 여부에 따라 처리 기준이 달라집니다. 요청 전 원 계산서 번호와 수정 사유를 정리해주세요."
  }
];

const statusStyles: Record<RequestStatus, string> = {
  요청접수: "ops-status-muted",
  "VIPS팀 확인중": "ops-status-info",
  완료: "ops-status-info",
  반려: "ops-status-attention"
};

const fallbackRequests: RequestItem[] = [
  {
    id: "REQ-20260514-004",
    type: "세금계산서 요청",
    kind: "taxInvoice",
    companyName: "아이씨뱅큐",
    requester: "sally@icbanq.com",
    requestedAt: "2026.05.14 13:42",
    issueDate: "2026-05-14",
    itemName: "전자부품 공급",
    quantity: "2",
    unitPrice: "10000",
    supplyAmount: "20000",
    totalAmount: "22,000원",
    note: "정기 거래처 발행 요청",
    status: "완료",
    result: "TX-20260514-003 발행 완료",
    processor: "VIPS팀",
    processedAt: "2026.05.14 15:20",
    details: { 업체명: "아이씨뱅큐", 품목명: "전자부품 공급", 총금액: "22,000원" }
  }
];

function Header({ userName, title, subtitle }: { userName?: string; title?: string; subtitle?: string }) {
  return (
    <header className="flex min-h-[64px] items-start justify-between">
      <div>
        <p className="mb-1 text-[12px] font-[850] text-[#1D50A2]">전자부품 유통 SALES 운영형 SaaS</p>
        <h1 className="text-[26px] font-[900] leading-8 tracking-[-0.01em] text-[#151922]">{title ?? `${userName}님, 오늘의 요청 흐름을 정리해볼까요?`}</h1>
        <p className="mt-1 text-[13px] font-[650] text-[#667085]">{subtitle ?? "세금계산서, 수금, 월마감 리스크를 한 화면에서 읽고 다음 행동으로 이어집니다."}</p>
      </div>
      <div className="flex items-center gap-3 pr-1 text-[#1D50A2]">
        <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#e7ecf4] bg-white shadow-sm">
          <Bell size={23} strokeWidth={2.1} />
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0b63df] text-[11px] font-[800] text-white">3</span>
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7ecf4] bg-white shadow-sm">
          <MessageSquare size={21} strokeWidth={2.1} />
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce6f6] bg-white shadow-sm">
          <UserRound size={22} strokeWidth={2.1} />
        </button>
      </div>
    </header>
  );
}

function Money({ value }: { value: string }) {
  const numeric = Number(String(value).replace(/[^0-9]/g, "") || 0);
  return <>{numeric ? numeric.toLocaleString("ko-KR") : "0"}원</>;
}

function currency(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function HomeActionCenter({ userName }: { userName: string }) {
  const closeItems = [
    {
      label: "계산서 발행 필요",
      count: monthlyCloseStatus.invoiceRequiredCount,
      amount: monthlyCloseStatus.invoiceRequiredAmount,
      icon: FileText,
      tone: "rose"
    },
    {
      label: "출고 확인 필요",
      count: monthlyCloseStatus.shipmentCheckCount,
      amount: monthlyCloseStatus.shipmentCheckAmount,
      icon: Truck,
      tone: "orange"
    },
    {
      label: "장기 미진행 거래",
      count: monthlyCloseStatus.longPendingCount,
      amount: monthlyCloseStatus.longPendingAmount,
      icon: CalendarCheck,
      tone: "violet"
    },
    {
      label: "Deduct 확인 필요",
      count: monthlyCloseStatus.deductCheckCount,
      amount: monthlyCloseStatus.deductCheckAmount,
      icon: ShieldCheck,
      tone: "teal"
    }
  ];

  const collectionItems: Array<{ label: string; value: string; emphasis?: boolean }> = [
    {
      label: "수금 확인 필요",
      value: `${collectionStatus.collectionCheckCount}건 / ${formatWon(collectionStatus.collectionCheckAmount)}`,
      emphasis: true
    },
    {
      label: "수금매칭 보류",
      value: `${collectionStatus.collectionMatchingPendingCount}건`
    },
    {
      label: "입금매칭 오류",
      value: `${collectionStatus.paymentMatchingErrorCount}건`
    }
  ];

  return (
    <section className="space-y-4">
      <article className="relative overflow-hidden rounded-[30px] border border-[#ffd9cf] bg-[linear-gradient(135deg,#fffafa_0%,#fff5ec_48%,#fff_100%)] p-7 shadow-[0_20px_55px_rgba(184,65,32,0.12)]">
        <div className="absolute right-9 top-8 hidden h-[150px] w-[150px] rounded-full bg-[#fff0e6] lg:block" />
        <div className="absolute right-[92px] top-[52px] hidden h-[88px] w-[88px] rounded-full border-[18px] border-[#ff4d45]/80 lg:block" />
        <div className="absolute right-[126px] top-[86px] hidden h-[22px] w-[22px] rounded-full bg-[#ff4d45] lg:block" />
        <div className="relative z-10 grid grid-cols-[1fr_420px] gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ffd4cb] bg-white/80 px-3 py-1.5 text-[12px] font-[850] text-[#e53d32]">
              <AlertTriangle size={15} />
              월마감·수금 우선 점검
            </span>
            <h1 className="mt-5 max-w-[760px] text-[34px] font-[950] leading-[1.18] tracking-[-0.02em] text-[#151922]">
              {userName}님, 오늘 확인해야 할 월마감·수금 건이 있습니다.
            </h1>
            <p className="mt-3 text-[15px] font-[700] text-[#596477]">출고, 계산서, 수금까지 끝나야 거래가 종료됩니다.</p>
            <div className="mt-6 flex items-end gap-4">
              <div>
                <p className="text-[13px] font-[850] text-[#e53d32]">확인 필요 거래</p>
                <p className="mt-1 text-[74px] font-[950] leading-none tracking-[-0.04em] text-[#ef2f2f]">
                  {actionSummary.totalNeedCheckCount}
                  <span className="ml-1 text-[34px] tracking-[-0.02em]">건</span>
                </p>
              </div>
              <div className="pb-2">
                <p className="text-[13px] font-[800] text-[#667085]">총 금액</p>
                <p className="mt-1 text-[24px] font-[950] tracking-[-0.02em] text-[#151922]">{formatWon(actionSummary.totalNeedCheckAmount)}</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_35px_rgba(21,31,53,0.08)]">
            <p className="text-[14px] font-[900] text-[#151922]">오늘 먼저 볼 것</p>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-[#fff4ef] px-4 py-3">
                <span className="text-[13px] font-[850] text-[#4d5668]">월마감 체크 필요</span>
                <span className="text-[22px] font-[950] text-[#F39945]">6건</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#edf4ff] px-4 py-3">
                <span className="text-[13px] font-[850] text-[#4d5668]">수금 확인 필요</span>
                <span className="text-[22px] font-[950] text-[#1D50A2]">1건</span>
              </div>
              <button onClick={() => (window.location.href = "/month-end")} className="mt-2 flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#F39945] px-5 py-4 text-[15px] font-[950] text-white shadow-[0_14px_24px_rgba(239,63,50,0.22)] transition hover:-translate-y-0.5">
                월마감·수금 점검하기
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </article>

      <div className="grid grid-cols-2 gap-4">
        <article className="rounded-[26px] border border-[#e9edf5] bg-white p-5 shadow-[0_14px_34px_rgba(21,31,53,0.055)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[20px] font-[950] tracking-[-0.01em] text-[#151922]">월마감 체크</h2>
              <p className="mt-1 text-[13px] font-[650] leading-5 text-[#667085]">계산서, 출고, Deduct 등 월마감 전 반드시 확인해야 할 거래입니다.</p>
            </div>
            <span className="rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[900] text-[#e53d32]">6건</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {closeItems.map((item) => (
              <div key={item.label} className="rounded-[20px] border border-[#eef1f6] bg-[#fbfcff] p-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  item.tone === "rose" ? "bg-[#fff5ec] text-[#F39945]" : item.tone === "orange" ? "bg-[#fff5ec] text-[#F39945]" : item.tone === "violet" ? "bg-[#edf4ff] text-[#1D50A2]" : "bg-[#eafaf7] text-[#1D50A2]"
                }`}>
                  <item.icon size={20} strokeWidth={2.2} />
                </span>
                <p className="mt-3 text-[13px] font-[850] text-[#384255]">{item.label}</p>
                <p className="mt-1 text-[24px] font-[950] tracking-[-0.02em] text-[#151922]">{item.count}건</p>
                <p className="mt-1 text-[12px] font-[800] text-[#667085]">{formatWon(item.amount)}</p>
              </div>
            ))}
          </div>
          <button onClick={() => (window.location.href = "/month-end")} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#151922] text-[14px] font-[900] text-white transition hover:-translate-y-0.5">
            월마감 점검하기
            <ArrowRight size={17} />
          </button>
        </article>

        <article className="rounded-[26px] border border-[#e9edf5] bg-white p-5 shadow-[0_14px_34px_rgba(21,31,53,0.055)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[20px] font-[950] tracking-[-0.01em] text-[#151922]">수금 체크</h2>
              <p className="mt-1 text-[13px] font-[650] leading-5 text-[#667085]">입금확인, 수금매칭, AR 보류 건을 확인합니다.</p>
            </div>
            <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-[12px] font-[900] text-[#1D50A2]">수금 이슈</span>
          </div>
          <div className="mt-5 space-y-3">
            {collectionItems.map((item) => (
              <div key={item.label} className={`flex items-center justify-between rounded-[20px] border px-4 py-4 ${
                item.emphasis ? "border-[#cfe1ff] bg-[#f3f8ff]" : "border-[#eef1f6] bg-[#fbfcff]"
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.emphasis ? "bg-white text-[#1D50A2]" : "bg-[#f1f4f8] text-[#5b6578]"}`}>
                    <Banknote size={20} strokeWidth={2.2} />
                  </span>
                  <span className="text-[14px] font-[850] text-[#384255]">{item.label}</span>
                </div>
                <span className="text-[15px] font-[950] text-[#151922]">{item.value}</span>
              </div>
            ))}
          </div>
          <button onClick={() => (window.location.href = "/collections")} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1D50A2] text-[14px] font-[900] text-white transition hover:-translate-y-0.5">
            수금 현황 확인하기
            <ArrowRight size={17} />
          </button>
        </article>
      </div>

      <article className="flex items-center justify-between rounded-[24px] border border-[#ffd8d4] bg-[#fff6f4] px-5 py-4">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#F39945] shadow-sm">
            <PackageCheck size={23} strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-[16px] font-[950] text-[#151922]">월마감·수금 확인이 끝나야 VIPS팀 요청을 진행할 수 있어요.</p>
            <p className="mt-1 text-[13px] font-[650] text-[#667085]">요청 전, 아직 종료되지 않은 거래를 먼저 확인해주세요.</p>
          </div>
        </div>
        <button onClick={() => (window.location.href = "/month-end")} className="flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-[13px] font-[900] text-[#F39945] shadow-sm">
          월마감 체크로 이동
          <ArrowRight size={16} />
        </button>
      </article>
    </section>
  );
}

function HomeUnifiedSearch() {
  const [query, setQuery] = useState("");
  const popularKeywords = ["수정세금계산서", "입금확인", "보증보험", "수금매칭", "계산서매칭"];
  const unifiedResults = [
    { type: "FAQ", title: "전월 수정세금계산서는 언제 요청하나요?", body: "월마감과 부가세 신고 흐름에 영향을 주므로 기존 계산서 링크와 수정 사유를 먼저 확인합니다." },
    { type: "실무가이드", title: "입금확인 요청 전 확인할 정보", body: "입금일자, 업체명/고객명, 입금금액, 입금계좌가 있어야 수금 흐름이 끊기지 않습니다." },
    { type: "사고사례", title: "수금매칭 누락으로 AR이 남은 사례", body: "입금은 완료됐지만 거래와 연결되지 않아 미수금으로 남은 케이스입니다." },
    { type: "업무프로세스", title: "견적부터 월마감까지 거래 흐름", body: "견적 → 발주 → 입고 → 출고 → 세금계산서 → 입금확인 → 수금매칭 → 월마감 순서로 종료됩니다." }
  ];
  const visibleResults = query.trim()
    ? unifiedResults.filter((item) => `${item.type} ${item.title} ${item.body}`.includes(query.trim())).slice(0, 4)
    : unifiedResults.slice(0, 3);

  return (
    <section className="sticky top-0 z-20 mb-4 rounded-[24px] border border-[#e7ecf4] bg-white/90 p-4 shadow-[0_14px_34px_rgba(21,31,53,0.07)] backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-12 flex-1 items-center gap-3 rounded-2xl border border-[#dfe7f2] bg-[#f8fbff] px-4">
          <Search size={18} className="text-[#1f5fe0]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="무엇을 찾고 계신가요?"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-[750] text-[#10203f] outline-none placeholder:text-[#8b98ad]"
          />
          <span className="rounded-lg border border-[#dfe7f2] bg-white px-2 py-1 text-[11px] font-[850] text-[#7a8495]">통합검색</span>
        </div>
        <button onClick={() => (window.location.href = "/guide")} className="h-12 rounded-2xl bg-[#151922] px-5 text-[13px] font-[900] text-white">
          교육센터
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {popularKeywords.map((keyword) => (
          <button
            key={keyword}
            type="button"
            onClick={() => setQuery(keyword)}
            className="rounded-full border border-[#e7ecf4] bg-white px-3 py-1.5 text-[12px] font-[850] text-[#1f5fe0] transition hover:border-[#bdd0fa] hover:bg-[#f3f7ff]"
          >
            {keyword}
          </button>
        ))}
      </div>
      {(query.trim() || visibleResults.length > 0) && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {visibleResults.map((item) => (
            <button
              key={`${item.type}-${item.title}`}
              type="button"
              onClick={() => (window.location.href = item.type === "FAQ" ? "/faq" : "/guide")}
              className="rounded-2xl border border-[#eef1f6] bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#cfe0fb] hover:shadow-sm"
            >
              <span className="rounded-full bg-[#edf4ff] px-2.5 py-1 text-[11px] font-[900] text-[#1f5fe0]">{item.type}</span>
              <p className="mt-2 text-[13px] font-[900] leading-5 text-[#151922]">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-[12px] font-[650] leading-5 text-[#667085]">{item.body}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CompactHomeDashboard({
  userName,
  requestItems,
  exchangeRates,
  exchangeSource,
  exchangeMessage,
  onSelectRequest,
  onSelectRequestKind
}: {
  userName: string;
  requestItems: RequestItem[];
  exchangeRates: ExchangeRatePoint[];
  exchangeSource: string;
  exchangeMessage: string;
  onSelectRequest: (item: RequestItem) => void;
  onSelectRequestKind: (kind: RequestKind) => void;
}) {
  const latestExchange = exchangeRates[exchangeRates.length - 1] ?? null;
  const isLiveExchange = exchangeSource === "exchangerate-api";
  const shortcutItems: Array<{ kind: RequestKind; label: string; icon: typeof FileText; tone: string; badge?: string }> = [
    { kind: "taxInvoice", label: "세금계산서\n발행 요청", icon: FileText, tone: "blue" },
    { kind: "revisedTaxInvoice", label: "수정세금계산서\n요청", icon: FileText, tone: "green" },
    { kind: "advancePayment", label: "선수금 처리\n요청", icon: Landmark, tone: "violet" },
    { kind: "guaranteeInsurance", label: "보증보험\n요청", icon: ShieldCheck, tone: "orange" },
    { kind: "invoiceMatching", label: "계산서매칭", icon: CheckCircle2, tone: "teal", badge: "NEW" },
    { kind: "collectionMatching", label: "수금매칭", icon: Banknote, tone: "pink", badge: "NEW" }
  ];
  const flowItems = [
    { title: "수정세금계산서 재확인", count: "2건", icon: FileText, color: "rose" },
    { title: "카드전표 누락 보완", count: "1건", icon: CreditCard, color: "blue" },
    { title: "수금매칭 보류 점검", count: "1건", icon: Banknote, color: "violet" },
    { title: "월마감 전 출고 흐름 확인", count: "3건", icon: Truck, color: "green" }
  ];
  const summaryItems: Array<{ label: string; count: string; amount: number; icon: typeof FileText; tone: string }> = [
    { label: "계산서 발행 필요", count: "3건", amount: monthlyCloseStatus.invoiceRequiredAmount, icon: FileText, tone: "rose" },
    { label: "출고 확인 필요", count: "2건", amount: monthlyCloseStatus.shipmentCheckAmount, icon: Truck, tone: "orange" },
    { label: "수금 확인 필요", count: "1건", amount: collectionStatus.collectionCheckAmount, icon: Banknote, tone: "blue" },
    { label: "장기 미진행 거래", count: "1건", amount: monthlyCloseStatus.longPendingAmount, icon: CalendarCheck, tone: "violet" },
    { label: "Deduct 확인 필요", count: "0건", amount: monthlyCloseStatus.deductCheckAmount, icon: ShieldCheck, tone: "teal" }
  ];
  const recentItems = requestItems.slice(0, 4);

  const iconTone = (tone: string) => {
    if (tone === "green") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "violet") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "orange") return "bg-[#fff0dc] text-[#F39945]";
    if (tone === "teal") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "pink") return "bg-[#ffeaf2] text-[#f04583]";
    return "bg-[#eaf2ff] text-[#1D50A2]";
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-11 w-[360px] items-center gap-3 rounded-2xl border border-[#e1e7f0] bg-white px-4 shadow-sm">
          <Search size={17} className="text-[#69758a]" />
          <input
            placeholder="검색어를 입력하세요"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-[750] text-[#10203f] outline-none placeholder:text-[#9aa5b6]"
          />
          <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[11px] font-[850] text-[#7a8495]">⌘K</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#e7ecf4] bg-white shadow-sm">
            <Bell size={20} className="text-[#667085]" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F39945] px-1 text-[10px] font-[900] text-white">12</span>
          </button>
          <div className="text-right">
            <p className="text-[13px] font-[900] text-[#151922]">{userName} Kim</p>
            <p className="text-[11px] font-[700] text-[#8a95a8]">영업1팀</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f7ff] text-[#1D50A2]">
            <UserRound size={21} />
          </span>
        </div>
      </div>

      <article className="relative overflow-hidden rounded-[28px] border border-[#e4eaf3] bg-white p-7 shadow-[0_18px_45px_rgba(21,31,53,0.08)]">
        <div className="absolute right-10 top-10 hidden h-[170px] w-[170px] rounded-full bg-[#fff1eb] lg:block" />
        <div className="absolute right-[96px] top-[58px] hidden h-[102px] w-[102px] rounded-full border-[20px] border-[#ff4b43] lg:block" />
        <div className="absolute right-[136px] top-[96px] hidden h-6 w-6 rounded-full bg-[#ff4b43] lg:block" />
        <div className="relative z-10">
          <p className="text-[18px] font-[950] tracking-[-0.01em] text-[#151922]">{userName}님, 오늘도 거래를 끝까지 책임져요!</p>
          <h1 className="mt-3 text-[40px] font-[950] leading-tight tracking-[-0.035em] text-[#151922]">
            확인 필요 거래가 <span className="text-[#ef2f2f]">7건</span> 있습니다
          </h1>
          <p className="mt-3 text-[15px] font-[700] text-[#687386]">거래가 끝나야 진짜 성과입니다.</p>

          <div className="mt-7 rounded-[24px] border border-[#edf1f6] bg-white/95 p-5 shadow-[0_16px_38px_rgba(21,31,53,0.08)]">
            <div className="grid grid-cols-[170px_repeat(5,1fr)] gap-4">
              <div className="border-r border-[#edf1f6] pr-4">
                <p className="text-[14px] font-[900] text-[#151922]">거래 종료 점검 현황</p>
                <p className="mt-5 text-[13px] font-[900] text-[#ef2f2f]">확인 필요 거래</p>
                <p className="mt-1 text-[56px] font-[950] leading-none tracking-[-0.05em] text-[#ef2f2f]">7<span className="text-[24px]">건</span></p>
                <p className="mt-3 text-[15px] font-[900] text-[#151922]">{formatWon(actionSummary.totalNeedCheckAmount)}</p>
              </div>
              {summaryItems.map(({ label, count, amount, icon: Icon, tone }) => (
                <div key={label} className={`rounded-[18px] px-4 py-4 text-center ${iconTone(tone)}`}>
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70">
                    <Icon size={21} />
                  </span>
                  <p className="mt-3 text-[12px] font-[900] text-[#151922]">{label}</p>
                  <p className="mt-2 text-[24px] font-[950] text-[#151922]">{count}</p>
                  <p className="mt-1 text-[11px] font-[850] text-[#30394a]">{formatWon(amount)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-[22px] bg-[#ff3647] px-8 py-5 text-white shadow-[0_16px_32px_rgba(239,63,50,0.22)]">
            <div className="flex items-center gap-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-[#F39945]">
                <AlertTriangle size={27} />
              </span>
              <p className="text-[18px] font-[950] leading-7">확인 필요 거래를 먼저 해결해야<br />VIPS팀 요청을 진행할 수 있어요.</p>
            </div>
            <button onClick={() => (window.location.href = "/month-end")} className="flex h-13 items-center gap-3 rounded-full bg-white px-9 text-[15px] font-[950] text-[#151922]">
              거래 종료 점검하기
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </article>

      <article className="mt-4 rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-[950] text-[#151922]">VIPS 요청 바로가기</h2>
          <button onClick={() => (window.location.href = "/requests")} className="rounded-full border border-[#e7ecf4] px-4 py-2 text-[12px] font-[900] text-[#34496b]">전체 메뉴</button>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-4">
          {shortcutItems.map((item) => (
            <button key={item.kind} onClick={() => onSelectRequestKind(item.kind)} className="relative flex h-[120px] flex-col items-center justify-center rounded-[18px] border border-[#edf1f6] bg-white text-center shadow-[0_10px_24px_rgba(21,31,53,0.045)] transition hover:-translate-y-0.5 hover:border-[#cbdaf5]">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconTone(item.tone)}`}>
                <item.icon size={24} />
              </span>
              <span className="mt-3 whitespace-pre-line text-[13px] font-[900] leading-[18px] text-[#151922]">{item.label}</span>
              {item.badge && <span className="absolute bottom-3 rounded-full bg-[#ffeff3] px-2 py-0.5 text-[10px] font-[950] text-[#F39945]">{item.badge}</span>}
            </button>
          ))}
        </div>
      </article>

      <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-4">
        <article className="rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-[950] text-[#151922]">나의 요청 현황</h2>
            <button onClick={() => (window.location.href = "/request-status")} className="text-[12px] font-[900] text-[#667085]">더보기</button>
          </div>
          <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-[#e6edf6] text-center">
            {[["접수", "12", "#1D50A2"], ["처리중", "8", "#F39945"], ["완료", "23", "#1D50A2"], ["반려", "2", "#F39945"]].map(([label, value, color]) => (
              <div key={label} className="border-r border-[#e6edf6] px-4 py-3 last:border-r-0">
                <p className="text-[12px] font-[900]" style={{ color }}>{label}</p>
                <p className="mt-1 text-[28px] font-[950]" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {recentItems.map((item) => (
              <button key={item.id} onClick={() => onSelectRequest(item)} className="grid w-full grid-cols-[90px_1fr_70px_56px] items-center gap-3 text-left text-[13px]">
                <span className="rounded-full bg-[#f2f6ff] px-3 py-1 text-center text-[11px] font-[900] text-[#1D50A2]">{item.type}</span>
                <span className="truncate font-[800] text-[#344054]">{item.companyName || item.result}</span>
                <span className={`rounded-full px-2 py-1 text-center text-[11px] font-[900] ${statusStyles[item.status]}`}>{item.status}</span>
                <span className="text-right text-[11px] font-[750] text-[#8a95a8]">방금</span>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
          <h2 className="text-[20px] font-[950] text-[#151922]">Today&apos;s Flow</h2>
          <p className="mt-1 text-[13px] font-[700] text-[#667085]">오늘 꼭 확인해야 할 업무</p>
          <div className="mt-4 space-y-3">
            {flowItems.map((item) => (
              <button key={item.title} className="flex h-[54px] w-full items-center justify-between rounded-2xl border border-[#edf1f6] px-4 text-left">
                <span className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconTone(item.color)}`}>
                    <item.icon size={18} />
                  </span>
                  <span className="text-[13px] font-[900] text-[#202633]">{item.title}</span>
                </span>
                <span className="flex items-center gap-2 text-[12px] font-[900] text-[#667085]">{item.count}<ChevronRight size={15} /></span>
              </button>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4">
        <article className="rounded-[22px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-[950] text-[#151922]">환율 정보</h3>
            <span className="text-[11px] font-[750] text-[#8a95a8]">{latestExchange?.baseDate ?? "-"}</span>
          </div>
          <p className="mt-5 text-[13px] font-[850] text-[#34496b]">USD</p>
          <p className="mt-2 text-[27px] font-[950] text-[#151922]">
            {isLiveExchange && latestExchange ? latestExchange.rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : exchangeMessage || "-"}
          </p>
          <button className="mt-6 text-[12px] font-[900] text-[#34496b]">전체 환율 보기</button>
        </article>
        <article className="rounded-[22px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <h3 className="text-[16px] font-[950] text-[#151922]">챌린지</h3>
          <div className="mt-4 flex items-center gap-4">
            <RunnerMark />
            <div>
              <p className="text-[13px] font-[950] text-[#151922]">달뱅 챌린지</p>
              <p className="mt-1 text-[12px] font-[750] text-[#1D50A2]">7일 연속 출석 중!</p>
              <p className="mt-2 text-[12px] font-[850] text-[#667085]">7 / 10일</p>
            </div>
          </div>
        </article>
        <article className="rounded-[22px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-[950] text-[#151922]">실무가이드</h3>
            <button onClick={() => (window.location.href = "/guide")} className="text-[12px] font-[900] text-[#667085]">더보기</button>
          </div>
          <p className="mt-4 text-[13px] font-[850] leading-6 text-[#34496b]">거래 흐름 한눈에 보기</p>
          <p className="mt-1 text-[12px] font-[700] leading-5 text-[#667085]">견적 → 발주 → 입고 → 출고 → 계산서 → 입금 → 수금 → 월마감</p>
          <button onClick={() => (window.location.href = "/guide")} className="mt-5 rounded-xl bg-[#f3f6fb] px-4 py-2 text-[12px] font-[900] text-[#34496b]">가이드 보기</button>
        </article>
        <article className="rounded-[22px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-[950] text-[#151922]">FAQ 검색</h3>
            <button onClick={() => (window.location.href = "/faq")} className="text-[12px] font-[900] text-[#667085]">더보기</button>
          </div>
          <div className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-[#e1e7f0] px-3">
            <Search size={15} className="text-[#8a95a8]" />
            <span className="text-[12px] font-[750] text-[#9aa5b6]">궁금한 내용을 검색해보세요</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["수정세금계산서", "입금확인", "계산서매칭", "수금매칭"].map((keyword) => (
              <span key={keyword} className="rounded-full bg-[#f3f6fb] px-3 py-1 text-[11px] font-[850] text-[#667085]">{keyword}</span>
            ))}
          </div>
        </article>
      </div>
      <footer className="mt-5 flex items-center justify-between px-1 pb-2 text-[11px] font-[750] text-[#8a95a8]">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1D50A2] text-[10px] font-[950] text-white">I</span>
          <span className="font-[900] text-[#1d2f4f]">ICBANQ OPS</span>
          <span>© ICBANQ. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-8">
          <button>공지사항</button>
          <button>1:1 문의</button>
          <button>이용가이드</button>
        </div>
      </footer>
    </section>
  );
}

function IcbHomeDashboard({
  userName,
  requestItems,
  exchangeRates,
  exchangeSource,
  exchangeMessage,
  onSelectRequest,
  onSelectRequestKind
}: {
  userName: string;
  requestItems: RequestItem[];
  exchangeRates: ExchangeRatePoint[];
  exchangeSource: string;
  exchangeMessage: string;
  onSelectRequest: (item: RequestItem) => void;
  onSelectRequestKind: (kind: RequestKind) => void;
}) {
  const latestExchange = exchangeRates[exchangeRates.length - 1] ?? null;
  const isLiveExchange = exchangeSource === "exchangerate-api";
  const recentItems = requestItems.slice(0, 4);
  const searchChips = ["수정세금계산서", "입금확인", "보증보험", "수금매칭", "계산서매칭"];
  const shortcutItems: Array<{ kind: RequestKind; label: string; icon: typeof FileText; tone: string; badge?: string }> = [
    { kind: "taxInvoice", label: "세금계산서\n발행 요청", icon: FileText, tone: "blue" },
    { kind: "revisedTaxInvoice", label: "수정세금계산서\n요청", icon: FileText, tone: "green" },
    { kind: "advancePayment", label: "선수금 처리\n요청", icon: Landmark, tone: "violet" },
    { kind: "guaranteeInsurance", label: "보증보험\n요청", icon: ShieldCheck, tone: "orange" },
    { kind: "invoiceMatching", label: "계산서매칭", icon: CheckCircle2, tone: "teal", badge: "NEW" },
    { kind: "collectionMatching", label: "수금매칭", icon: Banknote, tone: "pink", badge: "NEW" }
  ];
  const monthlyItems: Array<{ label: string; count: string; amount: number; icon: typeof FileText; tone: string }> = [
    { label: "계산서 발행 필요", count: "3건", amount: monthlyCloseStatus.invoiceRequiredAmount, icon: FileText, tone: "rose" },
    { label: "출고 확인 필요", count: "2건", amount: monthlyCloseStatus.shipmentCheckAmount, icon: Truck, tone: "orange" },
    { label: "장기 미진행 거래", count: "1건", amount: monthlyCloseStatus.longPendingAmount, icon: CalendarCheck, tone: "violet" },
    { label: "Deduct 확인 필요", count: "0건", amount: monthlyCloseStatus.deductCheckAmount, icon: ShieldCheck, tone: "teal" }
  ];
  const collectionItems = [
    { label: "수금 확인 필요", value: "1건", sub: formatWon(collectionStatus.collectionCheckAmount), hot: true },
    { label: "수금매칭 보류", value: "2건", sub: "부분입금/일괄입금 확인" },
    { label: "입금매칭 오류", value: "1건", sub: "입금자명/거래처 확인" }
  ];
  const flowItems: Array<{ title: string; count: string; icon: typeof FileText; tone: string }> = [
    { title: "수정세금계산서 재확인", count: "2건", icon: FileText, tone: "rose" },
    { title: "카드전표 누락 보완", count: "1건", icon: CreditCard, tone: "blue" },
    { title: "수금매칭 보류 점검", count: "1건", icon: Banknote, tone: "violet" },
    { title: "월마감 전 출고 흐름 확인", count: "3건", icon: Truck, tone: "green" }
  ];
  const toneClass = (tone: string) => {
    if (tone === "green") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "violet") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "orange") return "bg-[#fff0dc] text-[#F39945]";
    if (tone === "teal") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "pink") return "bg-[#ffeaf2] text-[#f04583]";
    if (tone === "rose") return "bg-[#fff5ec] text-[#F39945]";
    return "bg-[#eaf2ff] text-[#1D50A2]";
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-5">
        <div className="flex-1">
          <div className="mx-auto flex h-12 max-w-[560px] items-center gap-3 rounded-full border border-[#dfe7f2] bg-white px-5 shadow-[0_10px_24px_rgba(21,31,53,0.055)]">
            <Search size={18} className="text-[#667085]" />
            <input placeholder="무엇을 찾고 계신가요?" className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-[750] text-[#10203f] outline-none placeholder:text-[#9aa5b6]" />
            <span className="rounded-lg bg-[#f2f4f8] px-2 py-1 text-[11px] font-[900] text-[#7a8495]">⌘K</span>
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {searchChips.map((chip) => (
              <button key={chip} className="rounded-full border border-[#e7ecf4] bg-white px-3 py-1.5 text-[12px] font-[850] text-[#5d6b82] shadow-sm">{chip}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 pt-1">
          <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#e7ecf4] bg-white shadow-sm">
            <Bell size={20} className="text-[#667085]" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F39945] px-1 text-[10px] font-[900] text-white">12</span>
          </button>
          <div className="text-right">
            <p className="text-[13px] font-[900] text-[#151922]">{userName} Kim</p>
            <p className="text-[11px] font-[700] text-[#8a95a8]">영업1팀</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3f7ff] text-[#1D50A2]"><UserRound size={21} /></span>
        </div>
      </div>

      <article className="relative overflow-hidden rounded-[30px] border border-[#e3eaf4] bg-white p-8 shadow-[0_22px_60px_rgba(21,31,53,0.09)]">
        <div className="absolute right-10 top-8 hidden h-[210px] w-[210px] rounded-full bg-[#fff0eb] lg:block" />
        <div className="absolute right-[82px] top-[40px] hidden h-[150px] w-[150px] rounded-full border-[28px] border-[#ff4b43] lg:block" />
        <div className="absolute right-[142px] top-[100px] hidden h-8 w-8 rounded-full bg-[#ff4b43] lg:block" />
        <div className="absolute right-[118px] top-[78px] hidden h-4 w-[96px] rotate-[-28deg] rounded-full bg-[#F39945] shadow-lg lg:block" />
        <div className="relative z-10 max-w-[760px]">
          <p className="text-[19px] font-[950] tracking-[-0.01em] text-[#151922]">{userName}님, 오늘도 거래를 끝까지 책임져요!</p>
          <h1 className="mt-3 text-[46px] font-[950] leading-tight tracking-[-0.04em] text-[#151922]">확인 필요 거래가 <span className="text-[#ef2f2f]">7건</span> 있습니다</h1>
          <p className="mt-3 text-[16px] font-[750] text-[#687386]">거래가 끝나야 진짜 성과입니다.</p>
          <div className="mt-7 grid max-w-[720px] grid-cols-4 gap-3">
            {[
              ["확인 필요 거래", "7건", "text-[#ef2f2f]"],
              ["총 금액", formatWon(actionSummary.totalNeedCheckAmount), "text-[#151922]"],
              ["월마감 체크 필요", "6건", "text-[#F39945]"],
              ["수금 확인 필요", "1건", "text-[#1D50A2]"]
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-[20px] border border-[#edf1f6] bg-[#fbfcff] px-4 py-4">
                <p className="text-[12px] font-[850] text-[#667085]">{label}</p>
                <p className={`mt-2 text-[24px] font-[950] tracking-[-0.02em] ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <button onClick={() => (window.location.href = "/month-end")} className="mt-7 flex h-[52px] items-center gap-3 rounded-full bg-[#151922] px-7 text-[15px] font-[950] text-white shadow-[0_14px_26px_rgba(21,31,53,0.18)]">
            거래 종료 점검하기
            <ArrowRight size={18} />
          </button>
        </div>
      </article>

      <div className="grid grid-cols-2 gap-4">
        <article className="rounded-[28px] border border-[#e7ecf4] bg-white p-6 shadow-[0_16px_38px_rgba(21,31,53,0.06)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[22px] font-[950] text-[#151922]">월마감 체크</h2>
              <p className="mt-1 text-[13px] font-[700] text-[#667085]">계산서, 출고, Deduct 등 월마감 전 확인할 거래입니다.</p>
            </div>
            <span className="rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#F39945]">6건</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {monthlyItems.map((item) => (
              <div key={item.label} className="rounded-[22px] border border-[#eef1f6] bg-[#fbfcff] p-4">
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${toneClass(item.tone)}`}><item.icon size={21} /></span>
                <p className="mt-3 text-[13px] font-[900] text-[#30394a]">{item.label}</p>
                <p className="mt-1 text-[26px] font-[950] text-[#151922]">{item.count}</p>
                <p className="mt-1 text-[12px] font-[850] text-[#667085]">{formatWon(item.amount)}</p>
              </div>
            ))}
          </div>
          <button onClick={() => (window.location.href = "/month-end")} className="mt-5 h-[48px] w-full rounded-2xl bg-[#151922] text-[14px] font-[950] text-white">월마감 점검하기</button>
        </article>

        <article className="rounded-[28px] border border-[#e7ecf4] bg-white p-6 shadow-[0_16px_38px_rgba(21,31,53,0.06)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[22px] font-[950] text-[#151922]">수금 체크</h2>
              <p className="mt-1 text-[13px] font-[700] text-[#667085]">입금확인, 수금매칭, AR 보류 건을 확인합니다.</p>
            </div>
            <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-[12px] font-[950] text-[#1D50A2]">수금 이슈</span>
          </div>
          <div className="mt-5 space-y-3">
            {collectionItems.map((item) => (
              <div key={item.label} className={`flex min-h-[76px] items-center justify-between rounded-[22px] border px-4 ${item.hot ? "border-[#cfe1ff] bg-[#f3f8ff]" : "border-[#eef1f6] bg-[#fbfcff]"}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${item.hot ? "bg-white text-[#1D50A2]" : "bg-[#f1f4f8] text-[#667085]"}`}><Banknote size={21} /></span>
                  <div>
                    <p className="text-[14px] font-[900] text-[#30394a]">{item.label}</p>
                    <p className="mt-1 text-[12px] font-[750] text-[#667085]">{item.sub}</p>
                  </div>
                </div>
                <p className="text-[25px] font-[950] text-[#151922]">{item.value}</p>
              </div>
            ))}
          </div>
          <button onClick={() => (window.location.href = "/collections")} className="mt-5 h-[48px] w-full rounded-2xl bg-[#1D50A2] text-[14px] font-[950] text-white">수금 현황 확인하기</button>
        </article>
      </div>

      <article className="relative overflow-hidden rounded-[26px] border border-[#ffd8d4] bg-[#fff6f4] p-5 shadow-[0_12px_28px_rgba(239,63,50,0.08)]">
        <div className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#F39945] shadow-sm"><AlertTriangle size={27} /></span>
            <div>
              <p className="text-[18px] font-[950] text-[#151922]">월마감·수금 확인이 끝나야 VIPS팀 요청을 진행할 수 있어요.</p>
              <p className="mt-1 text-[13px] font-[750] text-[#667085]">요청 전, 아직 종료되지 않은 거래를 먼저 확인해주세요.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-sm lg:flex"><span className="h-9 w-9 rounded-full bg-[#1D50A2]" /></div>
            <button onClick={() => (window.location.href = "/month-end")} className="h-[48px] rounded-full bg-[#F39945] px-7 text-[14px] font-[950] text-white">거래 종료 점검센터로 이동</button>
          </div>
        </div>
      </article>

      <article className="rounded-[26px] border border-[#e7ecf4] bg-white p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-[950] text-[#151922]">VIPS팀 요청 바로가기</h2>
          <button onClick={() => (window.location.href = "/requests")} className="rounded-full border border-[#e7ecf4] px-4 py-2 text-[12px] font-[900] text-[#34496b]">전체 메뉴</button>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-4">
          {shortcutItems.map((item) => (
            <button key={item.kind} onClick={() => onSelectRequestKind(item.kind)} className="relative flex h-[118px] flex-col items-center justify-center rounded-[20px] border border-[#edf1f6] bg-white text-center shadow-[0_10px_24px_rgba(21,31,53,0.045)] transition hover:-translate-y-0.5 hover:border-[#cbdaf5]">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClass(item.tone)}`}><item.icon size={23} /></span>
              <span className="mt-3 whitespace-pre-line text-[13px] font-[900] leading-[18px] text-[#151922]">{item.label}</span>
              {item.badge && <span className="absolute bottom-3 rounded-full bg-[#ffeff3] px-2 py-0.5 text-[10px] font-[950] text-[#F39945]">{item.badge}</span>}
            </button>
          ))}
        </div>
      </article>

      <article className="rounded-[26px] border border-[#e7ecf4] bg-white p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-[950] text-[#151922]">나의 요청현황</h2>
          <button onClick={() => (window.location.href = "/request-status")} className="text-[12px] font-[900] text-[#667085]">더보기</button>
        </div>
        <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-[#e6edf6] text-center">
          {[["접수", "12", "#1D50A2"], ["처리중", "8", "#F39945"], ["완료", "23", "#1D50A2"], ["반려", "2", "#F39945"]].map(([label, value, color]) => (
            <div key={label} className="border-r border-[#e6edf6] px-4 py-3 last:border-r-0">
              <p className="text-[12px] font-[900]" style={{ color }}>{label}</p>
              <p className="mt-1 text-[28px] font-[950]" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3">
          {recentItems.map((item) => (
            <button key={item.id} onClick={() => onSelectRequest(item)} className="grid w-full grid-cols-[110px_1fr_84px_64px] items-center gap-3 rounded-2xl border border-[#edf1f6] px-4 py-3 text-left text-[13px]">
              <span className="rounded-full bg-[#f2f6ff] px-3 py-1 text-center text-[11px] font-[900] text-[#1D50A2]">{item.type}</span>
              <span className="truncate font-[850] text-[#344054]">{item.companyName || item.result}</span>
              <span className={`rounded-full px-2 py-1 text-center text-[11px] font-[900] ${statusStyles[item.status]}`}>{item.status}</span>
              <span className="text-right text-[11px] font-[750] text-[#8a95a8]">방금</span>
            </button>
          ))}
        </div>
      </article>

      <div className="grid grid-cols-4 gap-4">
        <article className="rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <h3 className="text-[16px] font-[950] text-[#151922]">Today&apos;s Flow</h3>
          <div className="mt-4 space-y-2">
            {flowItems.map((item) => (
              <div key={item.title} className="flex items-center justify-between rounded-2xl border border-[#edf1f6] px-3 py-3">
                <span className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${toneClass(item.tone)}`}><item.icon size={16} /></span><span className="text-[12px] font-[850] text-[#30394a]">{item.title}</span></span>
                <span className="text-[11px] font-[900] text-[#667085]">{item.count}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <h3 className="text-[16px] font-[950] text-[#151922]">실무가이드</h3>
          <p className="mt-4 text-[13px] font-[850] leading-6 text-[#34496b]">거래 흐름 한눈에 보기</p>
          <p className="mt-1 text-[12px] font-[700] leading-5 text-[#667085]">견적 → 발주 → 입고 → 출고 → 계산서 → 입금 → 수금 → 월마감</p>
          <button onClick={() => (window.location.href = "/guide")} className="mt-5 rounded-xl bg-[#f3f6fb] px-4 py-2 text-[12px] font-[900] text-[#34496b]">가이드 보기</button>
        </article>
        <article className="rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <h3 className="text-[16px] font-[950] text-[#151922]">성과 / 배지</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[["월마감", "3건"], ["수금률", "85%"], ["streak", "11일"], ["정확도", "97%"]].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-[#f8fbff] px-3 py-3"><p className="text-[11px] font-[800] text-[#667085]">{label}</p><p className="mt-1 text-[18px] font-[950] text-[#151922]">{value}</p></div>
            ))}
          </div>
        </article>
        <article className="rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-[950] text-[#151922]">환율 정보</h3>
            <span className="text-[11px] font-[750] text-[#8a95a8]">{latestExchange?.baseDate ?? "-"}</span>
          </div>
          <p className="mt-5 text-[13px] font-[850] text-[#34496b]">USD/KRW</p>
          <p className="mt-2 text-[27px] font-[950] text-[#151922]">{isLiveExchange && latestExchange ? latestExchange.rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : exchangeMessage || "-"}</p>
          <p className="mt-4 text-[11px] font-[750] text-[#667085]">ExchangeRate API 기준</p>
        </article>
      </div>
    </section>
  );
}

function MascotAsset({
  src,
  alt,
  fallback,
  className
}: {
  src: string;
  alt: string;
  fallback: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {!failed ? (
        <Image src={src} alt={alt} fill sizes="220px" onError={() => setFailed(true)} className="object-contain" />
      ) : (
        <span className="text-[38px] leading-none">{fallback}</span>
      )}
    </div>
  );
}

function StableHomeDashboard({
  userName,
  requestItems,
  exchangeRates,
  exchangeSource,
  exchangeMessage,
  onSelectRequest,
  onSelectRequestKind
}: {
  userName: string;
  requestItems: RequestItem[];
  exchangeRates: ExchangeRatePoint[];
  exchangeSource: string;
  exchangeMessage: string;
  onSelectRequest: (item: RequestItem) => void;
  onSelectRequestKind: (kind: RequestKind) => void;
}) {
  const latestExchange = exchangeRates[exchangeRates.length - 1] ?? null;
  const isLiveExchange = exchangeSource === "exchangerate-api";
  const recentItems = requestItems.slice(0, 4);
  const searchChips = ["수정세금계산서", "입금확인", "보증보험", "수금매칭", "계산서매칭"];
  const toneClass = (tone: string) => {
    if (tone === "red") return "bg-[#fff5ec] text-[#F39945]";
    if (tone === "orange") return "bg-[#fff3df] text-[#F39945]";
    if (tone === "purple") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "green") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "teal") return "bg-[#edf4ff] text-[#1D50A2]";
    if (tone === "pink") return "bg-[#ffeaf2] text-[#f04583]";
    return "bg-[#eaf2ff] text-[#1D50A2]";
  };
  const monthlyItems: Array<{ label: string; count: string; amount: string; icon: typeof FileText; tone: string }> = [
    { label: "계산서 발행 필요", count: "3건", amount: formatWon(monthlyCloseStatus.invoiceRequiredAmount), icon: FileText, tone: "red" },
    { label: "출고 확인 필요", count: "2건", amount: formatWon(monthlyCloseStatus.shipmentCheckAmount), icon: Truck, tone: "orange" },
    { label: "장기 미진행 거래", count: "1건", amount: formatWon(monthlyCloseStatus.longPendingAmount), icon: CalendarCheck, tone: "purple" },
    { label: "Deduct 확인 필요", count: "0건", amount: "0원", icon: ShieldCheck, tone: "teal" }
  ];
  const collectionItems: Array<{ label: string; value: string; sub: string; tone: string; hot?: boolean }> = [
    { label: "수금 확인 필요", value: "1건", sub: formatWon(collectionStatus.collectionCheckAmount), tone: "blue", hot: true },
    { label: "수금매칭 보류", value: "2건", sub: "부분입금/일괄입금 확인", tone: "purple" },
    { label: "입금매칭 오류", value: "1건", sub: "입금자명/거래처 확인", tone: "red" }
  ];
  const shortcuts: Array<{ kind: RequestKind; label: string; icon: typeof FileText; tone: string; badge?: string }> = [
    { kind: "taxInvoice", label: "세금계산서\n발행 요청", icon: FileText, tone: "blue" },
    { kind: "revisedTaxInvoice", label: "수정세금계산서\n요청", icon: FileText, tone: "green" },
    { kind: "advancePayment", label: "선수금 처리\n요청", icon: Landmark, tone: "purple" },
    { kind: "guaranteeInsurance", label: "보증보험\n요청", icon: ShieldCheck, tone: "orange" },
    { kind: "invoiceMatching", label: "계산서매칭", icon: CheckCircle2, tone: "teal", badge: "NEW" },
    { kind: "collectionMatching", label: "수금매칭", icon: Banknote, tone: "pink", badge: "NEW" }
  ];
  const flowItems: Array<{ title: string; count: string; icon: typeof FileText; tone: string }> = [
    { title: "수정세금계산서 재확인", count: "2건", icon: FileText, tone: "red" },
    { title: "카드전표 누락 보완", count: "1건", icon: CreditCard, tone: "blue" },
    { title: "수금매칭 보류 점검", count: "1건", icon: Banknote, tone: "purple" },
    { title: "월마감 전 출고 흐름 확인", count: "3건", icon: Truck, tone: "green" }
  ];

  return (
    <section className="mx-auto w-full max-w-[1600px] space-y-3 overflow-hidden">
      <header className="flex h-[74px] min-w-0 items-start justify-center">
        <div className="min-w-0">
          <div className="mx-auto flex h-[42px] w-[560px] max-w-full items-center gap-3 rounded-full border border-[#dfe7f2] bg-white px-5 shadow-[0_10px_24px_rgba(21,31,53,0.055)]">
            <Search size={18} className="shrink-0 text-[#667085]" />
            <input placeholder="무엇을 찾고 계신가요?" className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-[750] text-[#10203f] outline-none placeholder:text-[#9aa5b6]" />
            <span className="shrink-0 rounded-lg bg-[#f2f4f8] px-2 py-1 text-[11px] font-[900] text-[#7a8495]">⌘K</span>
          </div>
          <div className="mt-2 flex h-7 min-w-0 flex-wrap justify-center gap-2 overflow-hidden">
            {searchChips.map((chip) => (
              <button key={chip} className="h-7 rounded-full border border-[#e7ecf4] bg-white px-3 text-[12px] font-[850] text-[#5d6b82] shadow-sm">{chip}</button>
            ))}
          </div>
        </div>
      </header>

      <article className="grid h-[220px] min-w-0 grid-cols-[minmax(0,1fr)_340px] overflow-hidden rounded-[24px] border border-[#e3eaf4] bg-white shadow-[0_14px_34px_rgba(21,31,53,0.075)]">
        <div className="min-w-0 px-8 py-[26px]">
          <p className="truncate text-[18px] font-[950] tracking-[-0.01em] text-[#151922]">{userName}님, 오늘도 거래를 끝까지 책임져요!</p>
          <h1 className="mt-1.5 text-[36px] font-[950] leading-tight tracking-[-0.04em] text-[#151922]">
            확인 필요 거래가 <span className="text-[#ef2f2f]">7건</span> 있습니다
          </h1>
          <p className="mt-1.5 text-[14px] font-[750] text-[#687386]">거래가 끝나야 진짜 성과입니다.</p>
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2.5 xl:grid-cols-4">
            {[
              ["확인 필요 거래", "7건", "text-[#ef2f2f]"],
              ["총 금액", formatWon(actionSummary.totalNeedCheckAmount), "text-[#151922]"],
              ["월마감 체크 필요", "6건", "text-[#F39945]"],
              ["수금 확인 필요", "1건", "text-[#1D50A2]"]
            ].map(([label, value, color]) => (
              <div key={label} className="h-[66px] min-w-0 overflow-hidden rounded-[16px] border border-[#edf1f6] bg-[#fbfcff] px-[14px] py-2">
                <p className="truncate text-[12px] font-[850] text-[#667085]">{label}</p>
                <p className={`mt-1 truncate text-[22px] font-[950] tracking-[-0.02em] ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <button onClick={() => (window.location.href = "/month-end")} className="mt-3 flex h-[38px] w-fit items-center gap-2 rounded-full bg-[#151922] px-[22px] text-[13px] font-[950] text-white shadow-[0_10px_22px_rgba(21,31,53,0.18)]">
            거래 종료 점검하기
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="relative flex min-w-0 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#fff4ef_0%,#edf4ff_100%)]">
          <div className="absolute right-7 top-6 h-[164px] w-[164px] rounded-full bg-white/65" />
          <MascotAsset src="/assets/brand/bandol-full.png" alt="ICBANQ 반돌이" fallback="★" className="relative h-[170px] w-[170px] rounded-full" />
        </div>
      </article>

      <div className="grid h-[268px] min-w-0 grid-cols-2 gap-3 overflow-hidden">
        <article className="h-[268px] min-w-0 overflow-hidden rounded-[20px] border border-[#e7ecf4] bg-white p-4 shadow-[0_12px_28px_rgba(21,31,53,0.05)]">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-[950] text-[#151922]">월마감 체크</h2>
              <p className="mt-1 truncate text-[12px] font-[700] text-[#667085]">계산서, 출고, Deduct 등 월마감 전 확인할 거래입니다.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#F39945]">6건</span>
          </div>
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2.5">
            {monthlyItems.map((item) => (
              <div key={item.label} className="h-[58px] min-w-0 overflow-hidden rounded-[15px] border border-[#eef1f6] bg-[#fbfcff] px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneClass(item.tone)}`}><item.icon size={16} /></span>
                  <p className="truncate text-[12px] font-[900] text-[#30394a]">{item.label}</p>
                </div>
                <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
                  <p className="text-[20px] font-[950] leading-none text-[#151922]">{item.count}</p>
                  <p className="truncate text-[11px] font-[850] text-[#667085]">{item.amount}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => (window.location.href = "/month-end")} className="mt-3 h-[38px] w-full rounded-[14px] bg-[#151922] text-[13px] font-[950] text-white">월마감 점검하기</button>
        </article>

        <article className="h-[268px] min-w-0 overflow-hidden rounded-[20px] border border-[#e7ecf4] bg-white p-4 shadow-[0_12px_28px_rgba(21,31,53,0.05)]">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-[950] text-[#151922]">수금 체크</h2>
              <p className="mt-1 truncate text-[12px] font-[700] text-[#667085]">입금확인, 수금매칭, AR 보류 건을 확인합니다.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#edf4ff] px-3 py-1 text-[12px] font-[950] text-[#1D50A2]">수금 이슈</span>
          </div>
          <div className="mt-3 space-y-2">
            {collectionItems.map((item) => (
              <div key={item.label} className={`flex h-[42px] min-w-0 items-center justify-between gap-3 overflow-hidden rounded-[14px] border px-3 ${item.hot ? "border-[#cfe1ff] bg-[#f3f8ff]" : "border-[#eef1f6] bg-[#fbfcff]"}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.hot ? "bg-white text-[#1D50A2]" : "bg-[#f1f4f8] text-[#667085]"}`}><Banknote size={14} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-[900] text-[#30394a]">{item.label}</p>
                    <p className="truncate text-[11px] font-[750] text-[#667085]">{item.sub}</p>
                  </div>
                </div>
                <p className="shrink-0 text-[20px] font-[950] text-[#151922]">{item.value}</p>
              </div>
            ))}
          </div>
          <button onClick={() => (window.location.href = "/collections")} className="mt-3 h-[38px] w-full rounded-[14px] bg-[#1D50A2] text-[13px] font-[950] text-white">수금 현황 확인하기</button>
        </article>
      </div>

      <article className="h-[70px] min-w-0 overflow-hidden rounded-[18px] border border-[#ffe0bf] bg-[#fff8ec] px-[22px] py-[14px] shadow-[0_10px_22px_rgba(240,139,26,0.08)]">
        <div className="flex h-full min-w-0 items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#ef8a1a] shadow-sm"><AlertTriangle size={21} /></span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-[950] text-[#151922]">월마감·수금 확인이 끝나야 VIPS팀 요청을 진행할 수 있어요.</p>
              <p className="truncate text-[12px] font-[750] text-[#667085]">요청 전, 아직 종료되지 않은 거래를 먼저 확인해주세요.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <MascotAsset src="/assets/brand/bandol-full.png" alt="ICBANQ 반돌이" fallback="!" className="hidden h-16 w-20 bg-white/70 lg:flex" />
            <button onClick={() => (window.location.href = "/month-end")} className="h-[38px] rounded-full bg-[#ef8a1a] px-5 text-[13px] font-[950] text-white">거래 종료 점검센터로 이동</button>
          </div>
        </div>
      </article>

      <div className="grid h-[170px] min-w-0 grid-cols-2 gap-3 overflow-hidden">
        <article className="h-[170px] min-w-0 overflow-hidden rounded-[20px] border border-[#e7ecf4] bg-white p-[18px] shadow-[0_10px_24px_rgba(21,31,53,0.045)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-[950] text-[#151922]">VIPS팀 요청 바로가기</h2>
            <button onClick={() => (window.location.href = "/requests")} className="rounded-full border border-[#e7ecf4] px-3 py-1.5 text-[11px] font-[900] text-[#34496b]">전체 메뉴</button>
          </div>
          <div className="mt-3 grid min-w-0 grid-cols-6 gap-2">
            {shortcuts.map((item) => (
              <button key={item.kind} onClick={() => onSelectRequestKind(item.kind)} className="relative flex h-[88px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-[16px] border border-[#edf1f6] bg-white text-center shadow-[0_8px_18px_rgba(21,31,53,0.04)] transition hover:-translate-y-0.5 hover:border-[#cbdaf5]">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${toneClass(item.tone)}`}><item.icon size={18} /></span>
                <span className="mt-2 whitespace-pre-line text-[11px] font-[900] leading-[15px] text-[#151922]">{item.label}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="h-[170px] min-w-0 overflow-hidden rounded-[20px] border border-[#e7ecf4] bg-white p-[18px] shadow-[0_10px_24px_rgba(21,31,53,0.045)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-[950] text-[#151922]">나의 요청현황</h2>
            <button onClick={() => (window.location.href = "/request-status")} className="text-[11px] font-[900] text-[#667085]">더보기</button>
          </div>
          <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-[14px] border border-[#e6edf6] text-center">
            {[["접수", "12", "#1D50A2"], ["처리중", "8", "#F39945"], ["완료", "23", "#1D50A2"], ["반려", "2", "#F39945"]].map(([label, value, color]) => (
              <div key={label} className="border-r border-[#e6edf6] px-3 py-2 last:border-r-0">
                <p className="text-[11px] font-[900]" style={{ color }}>{label}</p>
                <p className="text-[20px] font-[950]" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          <button onClick={() => recentItems[0] && onSelectRequest(recentItems[0])} className="mt-3 grid w-full min-w-0 grid-cols-[92px_minmax(0,1fr)_62px_110px] items-center gap-2 rounded-[14px] border border-[#edf1f6] px-3 py-2 text-left text-[12px]">
            <span className="truncate rounded-full bg-[#f2f6ff] px-2 py-1 text-center text-[10px] font-[900] text-[#1D50A2]">세금계산서</span>
            <span className="truncate font-[850] text-[#344054]">아이씨뱅큐</span>
            <span className="rounded-full bg-[#edf4ff] px-2 py-1 text-center text-[10px] font-[900] text-[#1D50A2]">완료</span>
            <span className="truncate text-right text-[10px] font-[750] text-[#8a95a8]">2026.05.18 11:37</span>
          </button>
        </article>
      </div>

      <div className="grid h-[180px] min-w-0 grid-cols-4 gap-3 overflow-hidden">
        <article className="h-[180px] min-w-0 overflow-hidden rounded-[20px] border border-[#e7ecf4] bg-white p-[18px] shadow-[0_8px_20px_rgba(21,31,53,0.04)]">
          <h3 className="text-[16px] font-[950] text-[#151922]">Today&apos;s Flow</h3>
          <div className="mt-3 space-y-2">
            {flowItems.map((item) => (
              <div key={item.title} className="flex h-7 min-w-0 items-center justify-between gap-2 rounded-xl border border-[#edf1f6] px-2">
                <span className="truncate text-[12px] font-[850] text-[#30394a]">{item.title}</span>
                <span className="shrink-0 text-[11px] font-[900] text-[#667085]">{item.count}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="h-[180px] min-w-0 overflow-hidden rounded-[20px] border border-[#e7ecf4] bg-white p-[18px] shadow-[0_8px_20px_rgba(21,31,53,0.04)]">
          <h3 className="text-[16px] font-[950] text-[#151922]">실무가이드</h3>
          <p className="mt-3 text-[13px] font-[850] leading-6 text-[#34496b]">거래 흐름 한눈에 보기</p>
          <p className="mt-1 text-[12px] font-[700] leading-5 text-[#667085]">견적 → 발주 → 입고 → 출고 → 계산서 → 입금 → 수금 → 월마감</p>
          <button onClick={() => (window.location.href = "/guide")} className="mt-3 rounded-xl bg-[#f3f6fb] px-4 py-2 text-[12px] font-[900] text-[#34496b]">가이드 보기</button>
        </article>
        <article className="h-[180px] min-w-0 overflow-hidden rounded-[20px] border border-[#e7ecf4] bg-white p-[18px] shadow-[0_8px_20px_rgba(21,31,53,0.04)]">
          <h3 className="text-[16px] font-[950] text-[#151922]">성과 / 배지</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[["월마감", "3건"], ["수금률", "85%"], ["streak", "11일"], ["정확도", "97%"]].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-2xl bg-[#f8fbff] px-3 py-2"><p className="truncate text-[11px] font-[800] text-[#667085]">{label}</p><p className="truncate text-[18px] font-[950] text-[#151922]">{value}</p></div>
            ))}
          </div>
        </article>
        <article className="h-[180px] min-w-0 overflow-hidden rounded-[20px] border border-[#e7ecf4] bg-white p-[18px] shadow-[0_8px_20px_rgba(21,31,53,0.04)]">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-[950] text-[#151922]">환율 정보</h3>
            <span className="text-[11px] font-[750] text-[#8a95a8]">{latestExchange?.baseDate ?? "-"}</span>
          </div>
          <p className="mt-4 text-[13px] font-[850] text-[#34496b]">USD/KRW</p>
          <p className="mt-2 truncate text-[27px] font-[950] text-[#151922]">{isLiveExchange && latestExchange ? latestExchange.rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : exchangeMessage || "-"}</p>
          <p className="mt-3 text-[11px] font-[750] text-[#667085]">ExchangeRate API 기준</p>
        </article>
      </div>
    </section>
  );
}

function Field({
  label,
  required,
  value,
  type = "text",
  placeholder,
  error,
  readOnly,
  onChange
}: {
  label: string;
  required?: boolean;
  value: string;
  type?: string;
  placeholder?: string;
  error?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">
        {label}
        {required && <span className="text-[#F39945]">*</span>}
      </span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        className={`h-11 w-full rounded-md border bg-white px-3 text-[14px] font-[600] text-[#10203f] outline-none transition placeholder:text-[#8a9bb4] ${
          error ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea] focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]"
        } ${readOnly ? "bg-[#f4f8fd] text-[#0d45ad]" : ""}`}
      />
      {error && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
    </label>
  );
}

function InfoDialog({
  type,
  onConfirm,
  onCancel
}: {
  type: DialogType;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!type) return null;

  const content = {
    taxPrecheck: {
      title: "세금계산서 발행 전 확인",
      body: "IKI 내 업체 및 담당자 정보 미등록 시 세금계산서 발행이 불가능합니다.",
      confirm: "확인",
      cancel: "취소"
    },
    revisionPrecheck: {
      title: "수정세금계산서 요청 전 확인",
      body: "전월 세금계산서 마감건은 수정이 불가합니다. 반드시 수정 가능 여부를 확인 후 요청해주세요.",
      confirm: "확인 후 진행",
      cancel: "취소"
    },
    missing: {
      title: "누락사항을 확인하세요",
      body: "필수 입력값을 모두 입력해야 VIPS팀 요청으로 접수할 수 있습니다.",
      confirm: "확인",
      cancel: ""
    },
    success: {
      title: "요청 접수 완료",
      body: "요청이 정상 접수되었습니다. 나의 요청 현황에서 처리 상태를 확인할 수 있습니다.",
      confirm: "확인",
      cancel: ""
    }
  }[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b3e]/30 px-4">
      <div className="w-[440px] rounded-lg border border-[#d7e2f1] bg-white shadow-[0_22px_70px_rgba(15,35,70,0.22)]">
        <div className="border-b border-[#e3ebf6] px-6 py-5">
          <p className="text-[17px] font-[850] text-[#10203f]">{content.title}</p>
          <p className="mt-2 text-[13px] font-[650] leading-6 text-[#31445e]">{content.body}</p>
        </div>
        {type === "taxPrecheck" && (
          <div className="px-6 py-5">
            <div className="rounded-md bg-[#f4f8fd] px-4 py-3">
              {["업체명", "담당자명", "사업자등록번호"].map((item) => (
                <p key={item} className="flex items-center gap-2 py-1 text-[13px] font-[700] text-[#34496b]">
                  <CheckCircle2 size={15} className="text-[#1D50A2]" />
                  {item} IKI 등록 확인
                </p>
              ))}
            </div>
          </div>
        )}
        {type === "revisionPrecheck" && (
          <div className="px-6 py-5">
            <div className="rounded-md bg-[#f4f8fd] px-4 py-3">
              {["원 계산서 발행월 확인", "마감 여부 확인", "수정 사유 증빙 확인"].map((item) => (
                <p key={item} className="flex items-center gap-2 py-1 text-[13px] font-[700] text-[#34496b]">
                  <CheckCircle2 size={15} className="text-[#1D50A2]" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#e3ebf6] px-6 py-4">
          {content.cancel && (
            <button onClick={onCancel} className="h-10 rounded-md border border-[#cfdbea] bg-white px-5 text-[13px] font-[800] text-[#31445e]">
              {content.cancel}
            </button>
          )}
          <button onClick={onConfirm} className="h-10 rounded-md bg-[#1D50A2] px-6 text-[13px] font-[850] text-white">
            {content.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function GateBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <section className="mb-[11px] flex items-center justify-between rounded-lg border-2 border-[#ef4444] bg-[#fef2f2] px-5 py-4 shadow-[0_10px_24px_rgba(220,38,38,0.08)]">
      <div>
        <p className="text-[15px] font-[900] text-[#dc2626]">미종료 거래가 남아 있어 VIPS팀 요청 진입이 불가합니다.</p>
        <p className="mt-1 text-[12px] font-[750] text-[#991b1b]">거래 종료 관리에서 내 미종료 거래를 확인하고 IKI에서 정리해주세요.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => (window.location.href = "/month-end")} className="h-10 rounded-md bg-[#dc2626] px-4 text-[13px] font-[900] text-white shadow-[0_8px_16px_rgba(220,38,38,0.16)]">
          미종료 거래 확인하기
        </button>
        <button onClick={() => window.open("https://iki.icbanq.com", "_blank", "noopener,noreferrer")} className="h-10 rounded-md bg-[#1D50A2] px-4 text-[13px] font-[850] text-white">
          IKI 월마감 바로가기
        </button>
      </div>
    </section>
  );
}

function TopOperations({
  exchangeRates = [],
  exchangeSource = "loading",
  exchangeMessage = ""
}: {
  exchangeRates?: ExchangeRatePoint[];
  exchangeSource?: string;
  exchangeMessage?: string;
}) {
  const isLiveExchange = exchangeSource === "exchangerate-api";
  const latestExchange = exchangeRates[exchangeRates.length - 1] ?? null;
  const latestRate = latestExchange?.rate ?? 0;
  const latestBaseDate = latestExchange?.baseDate ?? "-";
  const historicalExchangeRates = exchangeRates.length > 1 ? exchangeRates : [];

  return (
    <section className="grid grid-cols-[330px_1fr_300px] gap-4">
      <article data-exchange-card="true" className="min-h-[300px] rounded-[24px] border border-[#e7ecf4] bg-white/95 p-5 shadow-[0_12px_30px_rgba(21,31,53,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-[900] text-[#151922]">Today&apos;s Flow</h2>
          <span className="rounded-full bg-[#fff1e9] px-3 py-1 text-[11px] font-[850] text-[#c65124]">운영 우선순위</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {tasks.map((task) => (
            <button key={task.title} className="grid min-h-[58px] w-full grid-cols-[36px_1fr_28px_14px] items-center gap-3 rounded-2xl border border-[#eef1f6] bg-white px-3 text-left transition hover:-translate-y-0.5 hover:border-[#dfe7f3] hover:shadow-sm">
              <span className={`flex h-9 w-9 items-center justify-center rounded-[14px] ${
                task.tone === "rose" ? "bg-[#fff5ec] text-[#F39945]" : task.tone === "green" ? "bg-[#edf4ff] text-[#1D50A2]" : task.tone === "amber" ? "bg-[#fff5ec] text-[#F39945]" : "bg-[#eef4ff] text-[#1D50A2]"
              }`}>
                <task.icon size={18} strokeWidth={2.25} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-[850] leading-[18px] text-[#202633]">{task.title}</span>
                <span className="mt-0.5 block text-[11px] font-[650] leading-[16px] text-[#7a8495]">{task.body}</span>
              </span>
              <span className="flex h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded-full bg-[#f3f6fb] px-1.5 text-[11px] font-[900] text-[#4b5568]">{task.count}</span>
              <ChevronRight size={15} className="shrink-0 text-[#164f9e]" />
            </button>
          ))}
        </div>
        <button className="mt-4 flex h-[42px] w-full items-center justify-center gap-2 rounded-2xl bg-[#f3f7ff] text-[13px] font-[850] text-[#1f5fe0]">
          전체 업무 보기
          <ArrowRight size={16} />
        </button>
      </article>

      <article className="min-h-[300px] rounded-[24px] border border-[#e7ecf4] bg-white/95 px-5 py-5 shadow-[0_12px_30px_rgba(21,31,53,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-[900] text-[#151922]">나의 운영성과</h2>
          <span className="rounded-full bg-[#e8f8f1] px-3 py-1 text-[11px] font-[850] text-[#12825f]">좋은 흐름</span>
        </div>
        <div className="mt-4 grid grid-cols-[190px_1fr] gap-4">
          <div className="rounded-[22px] bg-gradient-to-br from-[#f4fbf8] to-[#f8fbff] p-4">
            <p className="text-[12px] font-[800] text-[#667085]">반려 없는 요청 streak</p>
            <p className="mt-2 text-[42px] font-[950] leading-none tracking-[-0.02em] text-[#151922]">11일</p>
            <p className="mt-2 text-[12px] font-[750] text-[#12825f]">오류 ZERO 배지 진행 중</p>
          </div>
          <div className="pt-1">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["월마감 확인건", "3건"],
                ["최근 정확도", "97%"],
                ["수금률", "85%"]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#eef1f6] bg-white px-3 py-3">
                  <p className="text-[11px] font-[700] text-[#5b6b84]">{label}</p>
                  <p className="mt-1 text-[20px] font-[900] text-[#202633]">{value}</p>
                </div>
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {["반려 요청 최소화", "월마감 기한 내 완료", "수금 확인 지연 없음", "VIPS팀 요청 정확도 유지"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-[12px] font-[700] text-[#31445e]">
                  <CheckCircle2 size={15} className="text-[#1D50A2]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 border-t border-[#edf1f6] pt-3 text-[13px]">
          <p className="font-[650] text-[#34496b]">연속 달성 <b className="ml-2 text-[#0a2c6f]">5개월</b></p>
          <p className="text-right font-[650] text-[#34496b]">이번 달 달성률 <b className="ml-3 text-[20px] text-[#1D50A2]">100%</b></p>
        </div>
      </article>

      <article className="min-h-[300px] rounded-[24px] border border-[#e7ecf4] bg-white/95 p-5 shadow-[0_12px_30px_rgba(21,31,53,0.06)]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-[900] text-[#151922]">오늘의 달러</h2>
            <p className="mt-1 text-[12px] font-[650] text-[#5b6b84]">오늘 기준 환율 참고</p>
          </div>
          <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-[11px] font-[850] text-[#1f5fe0]">USD/KRW</span>
        </div>
        <div className="mt-5">
          {isLiveExchange ? (
            <>
              <p data-exchange-rate="true" className="text-[25px] font-[850] tracking-[-0.01em] text-black">
                {latestRate.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="ml-1 text-[13px] font-[700]">원</span>
              </p>
              <p data-exchange-status="true" className="mt-1 text-[12px] font-[700] text-[#34496b]">USD/KRW 기준 환율</p>
            </>
          ) : (
            <>
              <p data-exchange-rate="true" className="text-[22px] font-[850] tracking-[-0.01em] text-[#10203f]">
                {exchangeSource === "loading" ? "환율 데이터 확인 중" : "환율 정보를 불러오지 못했습니다."}
              </p>
              <p data-exchange-status="true" className="mt-1 text-[12px] font-[700] text-[#5b6b84]">{exchangeMessage || "임시 데이터 표시 중"}</p>
            </>
          )}
        </div>
        <div className="mt-5 rounded-md border border-[#e4edf8] bg-[#f8fbff] px-4 py-3">
          <div className="flex items-center justify-between border-b border-[#e4edf8] pb-2">
            <span className="text-[12px] font-[750] text-[#5b6b84]">기준일</span>
            <span data-exchange-base-date="true" className="text-[13px] font-[850] text-[#10203f]">{isLiveExchange ? latestBaseDate : "-"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[#e4edf8] py-2">
            <span className="text-[12px] font-[750] text-[#5b6b84]">통화</span>
            <span className="text-[13px] font-[850] text-[#10203f]">USD/KRW</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-[12px] font-[750] text-[#5b6b84]">출처</span>
            <span className="text-[13px] font-[850] text-[#1D50A2]">ExchangeRate API</span>
          </div>
        </div>
        {historicalExchangeRates.length > 0 && <div className="hidden" data-exchange-history-ready="true" />}
        <p data-exchange-footer="true" className="mt-3 text-[12px] font-[650] text-[#5b6b84]">
          {isLiveExchange ? "최신 단일 환율 기준입니다." : "임시 데이터 표시 중"}
        </p>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const applyExchangeRate = (payload) => {
                  const rateTarget = document.querySelector("[data-exchange-rate]");
                  const statusTarget = document.querySelector("[data-exchange-status]");
                  const baseDateTarget = document.querySelector("[data-exchange-base-date]");
                  const footerTarget = document.querySelector("[data-exchange-footer]");
                  const rate = Number(payload && (payload.latestRate || payload.dealBasR));
                  if (!rateTarget || !statusTarget || !baseDateTarget || !footerTarget || !rate) return;
                  rateTarget.innerHTML = rate.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '<span class="ml-1 text-[13px] font-[700]">원</span>';
                  rateTarget.className = "text-[25px] font-[850] tracking-[-0.01em] text-black";
                  statusTarget.textContent = "USD/KRW 기준 환율";
                  statusTarget.className = "mt-1 text-[12px] font-[700] text-[#34496b]";
                  baseDateTarget.textContent = payload.baseDate || (payload.rates && payload.rates[0] && payload.rates[0].baseDate) || "-";
                  footerTarget.textContent = "최신 단일 환율 기준입니다.";
                };
                fetch("/api/exchange-rate", { cache: "no-store" })
                  .then((response) => response.json())
                  .then(applyExchangeRate)
                  .catch(() => {});
              })();
            `
          }}
        />
      </article>
    </section>
  );
}

function KpiStrip({ tradeClose }: { tradeClose: TradeCloseUserSummary }) {
  const dynamicKpis = kpis.map((kpi) => {
    if (kpi.label === "월마감 완료") {
      return {
        label: "거래 건강도",
        value: `${tradeClose.healthScore}점`,
        sub: "정상 종료 기준",
        delta: tradeClose.unresolvedCount > 0 ? `미종료 ${tradeClose.unresolvedCount}건` : "정상"
      };
    }
    return kpi;
  });

  return (
    <section className="mb-4 grid grid-cols-4 gap-4">
      {dynamicKpis.map((kpi) => (
        <article key={kpi.label} className="rounded-[22px] border border-[#e7ecf4] bg-white/95 px-5 py-4 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <p className="text-[12px] font-[850] text-[#667085]">{kpi.label}</p>
          <p className="mt-2 text-[30px] font-[950] leading-8 tracking-[-0.02em] text-[#151922]">{kpi.value}</p>
          <div className="mt-4 flex items-center justify-between text-[12px]">
            <span className="font-[650] text-[#7a8495]">{kpi.sub}</span>
            <span className="rounded-full bg-[#f3f7ff] px-2.5 py-1 font-[850] text-[#1f5fe0]">{kpi.delta}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function RequestStatusCard({ items, onSelectRequest }: { items: RequestItem[]; onSelectRequest: (item: RequestItem) => void }) {
  return (
    <article className="mt-4 rounded-[24px] border border-[#e7ecf4] bg-white/95 p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-[900] text-[#151922]">나의 요청현황</h2>
          <p className="mt-1 text-[12px] font-[600] text-[#5b6b84]">요청접수, 처리중, 완료, 반려 상태와 처리결과를 확인합니다.</p>
        </div>
        <button onClick={() => (window.location.href = "/request-status")} className="flex h-9 items-center gap-1 rounded-full border border-[#e7ecf4] bg-[#f8fbff] px-4 text-[12px] font-[850] text-[#1f5fe0]">
          전체 보기
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#edf1f6]">
        <div className="grid grid-cols-[1.05fr_1fr_120px_1.5fr] bg-[#f8fafc] px-4 py-2 text-[12px] font-[850] text-[#667085]">
          <span>요청 종류</span>
          <span>요청일시</span>
          <span>상태</span>
          <span>처리 결과</span>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] font-[650] text-[#5b6b84]">아직 표시할 요청이 없습니다.</div>
        ) : (
          items.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectRequest(item)}
              className="grid w-full grid-cols-[1.05fr_1fr_120px_1.5fr] items-center border-t border-[#e5edf7] px-4 py-3 text-left text-[13px] transition hover:bg-[#f8fbff]"
            >
              <div>
                <p className="font-[800] text-[#10203f]">{item.type}</p>
                <p className="mt-1 text-[11px] font-[600] text-[#7a8ba4]">{item.id}</p>
              </div>
              <span className="font-[650] text-[#34496b]">{item.requestedAt}</span>
              <span className={`w-fit rounded-full border px-3 py-1 text-[12px] font-[850] ${statusStyles[item.status]}`}>{item.status}</span>
              <span className="font-[750] text-[#10203f]">{item.result}</span>
            </button>
          ))
        )}
      </div>
    </article>
  );
}

function RequestShortcuts({ onSelect }: { onSelect: (kind: RequestKind) => void }) {
  const visibleShortcutKinds: RequestKind[] = [
    "taxInvoice",
    "revisedTaxInvoice",
    "advancePayment",
    "guaranteeInsurance",
    "invoiceMatching",
    "collectionMatching"
  ];
  const shortcutLabels: Partial<Record<RequestKind, string>> = {
    taxInvoice: "세금계산서 발행 요청",
    revisedTaxInvoice: "수정세금계산서 요청",
    advancePayment: "선수금 처리 요청",
    guaranteeInsurance: "보증보험 요청",
    invoiceMatching: "계산서매칭",
    collectionMatching: "수금매칭"
  };
  const shortcutIcons: Partial<Record<RequestKind, typeof FileText>> = {
    taxInvoice: FileText,
    revisedTaxInvoice: FileText,
    advancePayment: Landmark,
    guaranteeInsurance: ShieldCheck,
    invoiceMatching: CheckCircle2,
    collectionMatching: Banknote
  };

  return (
    <section className="rounded-[24px] border border-[#e7ecf4] bg-white/95 p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-[900] text-[#151922]">VIPS팀 요청 바로가기</h2>
          <p className="mt-1 text-[12px] font-[600] text-[#5b6b84]">거래 종료 상태를 먼저 확인한 뒤 필요한 요청을 진행합니다.</p>
        </div>
        <button onClick={() => (window.location.href = "/requests")} className="flex items-center gap-1 rounded-full bg-[#f3f7ff] px-3 py-2 text-[12px] font-[850] text-[#1f5fe0]">
          전체 요청 보기
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-3">
        {visibleShortcutKinds.map((kind) => {
          const config = REQUEST_FORM_CONFIGS[kind];
          const Icon = shortcutIcons[kind] ?? FileText;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onSelect(kind)}
              className="flex h-[126px] flex-col items-center justify-center rounded-[20px] border border-[#edf1f6] bg-white px-3 text-center transition hover:-translate-y-0.5 hover:border-[#bdd0fa] hover:bg-[#f8fbff] hover:shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d4e4f7] bg-[#f3f8ff] text-[#1D50A2]">
                <Icon size={23} strokeWidth={2.05} />
              </span>
              <p className="mt-3 text-[12px] font-[800] leading-[18px] text-[#10203f]">{shortcutLabels[kind] ?? config.title}</p>
              <ArrowRight size={15} className="mt-2 text-[#0d4fbf]" />
            </button>
          );
        })}
        <a
          href="/requests"
          className="flex h-[126px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#c7d7eb] bg-[#f8fbff] px-3 text-center transition hover:-translate-y-0.5 hover:border-[#1D50A2] hover:bg-[#edf4ff]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6b7d98] shadow-sm">
            <PlusCircle size={23} strokeWidth={2} />
          </span>
          <p className="mt-3 text-[12px] font-[800] leading-[18px] text-[#10203f]">전체 요청<br />보기</p>
          <ArrowRight size={15} className="mt-2 text-[#0d4fbf]" />
        </a>
      </div>
    </section>
  );
}

function BadgeMark({ tone = "blue" }: { tone?: "blue" | "green" | "gray" }) {
  const fill = tone === "green" ? "#1D50A2" : tone === "gray" ? "#65758b" : "#1D50A2";
  const dark = tone === "green" ? "#1D50A2" : tone === "gray" ? "#3b4758" : "#083b91";

  return (
    <svg width="58" height="58" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M19 43 14 59l10-5 8 8 4-17-17-2Z" fill={dark} opacity=".72" />
      <path d="M45 43 50 59l-10-5-8 8-4-17 17-2Z" fill={dark} opacity=".62" />
      <path d="M32 5 48.5 14.5v19L32 43 15.5 33.5v-19L32 5Z" fill={fill} />
      <path d="M32 10.5 43.7 17.3v13.4L32 37.5l-11.7-6.8V17.3L32 10.5Z" fill="white" opacity=".18" />
      <circle cx="32" cy="24" r="10.5" fill="#ffffff" opacity=".92" />
      <path d="m27.5 24 3 3.2 6.4-7.1" fill="none" stroke={fill} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MyBadgesCard() {
  const badges = [
    { title: "정확 요청 우수자", date: "2026.05 획득", tone: "blue" as const },
    { title: "월마감 리더", date: "2026.05 획득", tone: "blue" as const },
    { title: "수금관리 우수", date: "2026.04 획득", tone: "green" as const },
    { title: "반려율 개선", date: "2026.03 획득", tone: "gray" as const }
  ];

  return (
    <section className="rounded-[24px] border border-[#e7ecf4] bg-white/95 p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-[900] text-[#151922]">운영 배지</h2>
          <p className="mt-1 text-[12px] font-[600] text-[#667085]">판매 이후 거래 종료까지 관리한 운영 성장 기록입니다.</p>
        </div>
        <button onClick={() => (window.location.href = "/performance")} className="flex items-center gap-1 rounded-full bg-[#f3f7ff] px-3 py-2 text-[12px] font-[850] text-[#1f5fe0]">
          전체 보기
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        {badges.map((badge) => (
          <div key={badge.title} className="flex h-[120px] flex-col items-center justify-center rounded-[20px] border border-[#edf1f6] bg-[#fbfdff] px-2 text-center">
            <BadgeMark tone={badge.tone} />
            <p className="mt-2 text-[12px] font-[850] leading-4 text-[#10203f]">{badge.title}</p>
            <p className="mt-1 text-[11px] font-[650] text-[#5b6b84]">{badge.date}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-[#e7ecf4] bg-[#f8fbff] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-[800] text-[#34496b]">이번 분기 성과 포인트</span>
          <span className="text-[13px] font-[850] text-[#1D50A2]">7 / 10</span>
        </div>
        <div className="mt-2 grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }).map((_, index) => (
            <span key={index} className={`h-3 rounded-full ${index < 7 ? "bg-[#1D50A2]" : "bg-[#dce6f3]"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RunnerMark() {
  return (
    <svg width="74" height="74" viewBox="0 0 90 74" aria-hidden="true">
      <path d="M8 61c13 5 43 6 67 0" stroke="#d7e6f8" strokeWidth="5" strokeLinecap="round" />
      <circle cx="53" cy="14" r="7" fill="#1D50A2" />
      <path d="M40 27c7-8 18-7 25 2l5 7-8 5-4-6-11 12-13-8 6-12Z" fill="#0b63df" />
      <path d="m39 41-15 12m23-7-6 17m25-31 12-6M24 53l-9 8m26 2 14 5" stroke="#0b3f92" strokeWidth="6" strokeLinecap="round" />
      <path d="M31 26c-8 5-15 7-20 6" stroke="#2f8fef" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 52c7 5 17 7 29 6" stroke="#8bc7ff" strokeWidth="4" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

function BookChallengeMark() {
  return (
    <svg width="74" height="74" viewBox="0 0 90 74" aria-hidden="true">
      <path d="M22 19c12 0 18 5 23 10 5-5 11-10 23-10v38c-11 0-18 4-23 9-5-5-12-9-23-9V19Z" fill="#e9f6ee" />
      <path d="M45 29v36M22 19v38c11 0 18 4 23 9V29c-5-5-11-10-23-10Zm46 0v38c-11 0-18 4-23 9V29c5-5 11-10 23-10Z" fill="none" stroke="#1D50A2" strokeWidth="4" strokeLinejoin="round" />
      <path d="M31 29h7M31 38h8M52 31h8M52 40h7" stroke="#1D50A2" strokeWidth="3" strokeLinecap="round" opacity=".75" />
      <circle cx="28" cy="10" r="3" fill="#f6a04d" opacity=".75" />
      <path d="M44 8v8M61 10l-5 7" stroke="#f6a04d" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <circle cx="45" cy="68" r="5" fill="#1D50A2" />
    </svg>
  );
}

function ExploreAndHelp() {
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [openSearchTitle, setOpenSearchTitle] = useState<string | null>(homeSearchItems[0].title);
  const homeSearchResults = useMemo(() => {
    const keyword = homeSearchQuery.trim();
    const filtered = keyword
      ? homeSearchItems.filter((item) => [item.title, ...item.keywords].some((value) => value.includes(keyword)))
      : homeSearchItems;
    return filtered.slice(0, 3);
  }, [homeSearchQuery]);

  return (
    <>
      <section className="mt-4 grid grid-cols-[0.95fr_1.05fr] gap-4">
        <article className="rounded-[24px] border border-[#e7ecf4] bg-white/95 p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[18px] font-[900] text-[#151922]">검색하기</h2>
              <p className="mt-1 text-[12px] font-[600] text-[#5b6b84]">페이지 이동 없이 홈에서 바로 실무 상황을 찾습니다.</p>
            </div>
            <Search size={18} className="text-[#1D50A2]" />
          </div>
          <div className="mt-4 flex h-12 items-center gap-3 rounded-2xl border border-[#e1e7f0] bg-[#f8fbff] px-4">
            <Search size={16} className="shrink-0 text-[#1D50A2]" />
            <input
              value={homeSearchQuery}
              onChange={(event) => {
                setHomeSearchQuery(event.target.value);
                setOpenSearchTitle(null);
              }}
                      placeholder="계산서매칭, 수금매칭, 입금 매칭 오류"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-[700] text-[#10203f] outline-none placeholder:text-[#7f90a8]"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {searchKeywords.map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => {
                  setHomeSearchQuery(keyword);
                  setOpenSearchTitle(keyword);
                }}
                className="rounded-full border border-[#e7ecf4] bg-white px-3 py-1.5 text-[12px] font-[800] text-[#1f5fe0]"
              >
                {keyword}
              </button>
            ))}
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#e7ecf4]">
            {homeSearchResults.length > 0 ? (
              homeSearchResults.map((item) => {
                const open = openSearchTitle === item.title;
                return (
                  <section key={item.title} className="border-t border-[#e4edf8] first:border-t-0">
                    <button
                      type="button"
                      onClick={() => setOpenSearchTitle(open ? null : item.title)}
                      className="flex w-full items-center justify-between bg-white px-3 py-2.5 text-left hover:bg-[#f8fbff]"
                    >
                      <span className="text-[13px] font-[850] text-[#10203f]">{item.title}</span>
                      <ChevronRight size={15} className={`text-[#1D50A2] transition ${open ? "rotate-90" : ""}`} />
                    </button>
                    {open && <p className="border-t border-[#eef3fa] bg-[#f8fbff] px-3 py-3 text-[12px] font-[650] leading-5 text-[#435a7b]">{item.body}</p>}
                  </section>
                );
              })
            ) : (
              <p className="bg-[#f8fbff] px-3 py-3 text-[12px] font-[700] text-[#5b6b84]">검색 결과가 없습니다.</p>
            )}
          </div>
        </article>
        <article className="rounded-[24px] border border-[#e7ecf4] bg-white/95 p-5 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-[900] text-[#151922]">실무가이드</h2>
              <p className="mt-1 text-[12px] font-[600] text-[#667085]">왜 위험한지, 왜 필요한지, 왜 통제하는지 사례로 익힙니다.</p>
            </div>
            <button onClick={() => (window.location.href = "/guide")} className="h-9 rounded-full bg-[#f3f7ff] px-4 text-[12px] font-[850] text-[#1f5fe0]">
              가이드 보기
            </button>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {["거래 흐름", "세금계산서", "월마감", "수금 흐름"].map((item) => (
              <div key={item} className="rounded-2xl border border-[#edf1f6] bg-[#f8fbff] px-3 py-4 text-center">
                <p className="text-[12px] font-[800] text-[#10203f]">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-4 grid grid-cols-[1fr_1fr_1.35fr] gap-4">
        <article className="flex min-h-[142px] items-center gap-4 rounded-[24px] border border-[#e7ecf4] bg-gradient-to-br from-white to-[#fff8e7] px-5 py-4 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
          <div className="flex h-[92px] w-[98px] shrink-0 items-center justify-center rounded-[24px] bg-[#fff1c7]">
            <RunnerMark />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-[900] text-[#151922]">달뱅 챌린지</p>
            <p className="mt-1 text-[12px] font-[650] leading-5 text-[#667085]">출석 7일째. 카드전표 누락 ZERO 루틴을 완주해요.</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f2e5bf]"><span className="block h-full w-[72%] rounded-full bg-gradient-to-r from-[#1ca678] to-[#ffd86b]" /></div>
          </div>
          <button className="h-9 shrink-0 rounded-full bg-[#1f5fe0] px-4 text-[12px] font-[850] text-white">참여</button>
        </article>
        <article className="flex min-h-[142px] items-center gap-4 rounded-[24px] border border-[#e7ecf4] bg-gradient-to-br from-white to-[#f3efff] px-5 py-4 shadow-[0_12px_30px_rgba(21,31,53,0.055)]">
          <div className="flex h-[92px] w-[98px] shrink-0 items-center justify-center rounded-[24px] bg-[#edf7f0] text-[#1D50A2]">
            <BookChallengeMark />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-[900] text-[#151922]">북뱅 챌린지</p>
            <p className="mt-1 text-[12px] font-[650] leading-5 text-[#667085]">완독 배지 2개. 조용히 쌓이는 실무 이해를 기록합니다.</p>
            <div className="mt-3 flex gap-1.5"><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-[850] text-[#1D50A2]">완독 배지</span><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-[850] text-[#7c6ce4]">학습 streak</span></div>
          </div>
          <button className="h-9 shrink-0 rounded-full bg-[#1f5fe0] px-4 text-[12px] font-[850] text-white">참여</button>
        </article>
        <article className="min-h-[142px] rounded-[24px] border border-[#e7ecf4] bg-[#202736] p-5 text-white shadow-[0_12px_30px_rgba(21,31,53,0.12)]">
          <h2 className="text-[17px] font-[900] text-white">빠른 도움</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["FAQ 검색", "요청 가이드", "VIPS 문의"].map((item) => (
              <button key={item} className="flex h-[48px] items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-3">
                <span className="text-left text-[12px] font-[750] leading-4 text-white">{item}</span>
                <ChevronRight size={15} className="text-white" />
              </button>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function VipsRequestForm({
  kind,
  values,
  submitted,
  totalAmount,
  onBack,
  onChange,
  onFileSelect,
  onSubmit,
  onInvalidSubmit
}: {
  kind: RequestKind;
  values: RequestFormValues;
  submitted: boolean;
  totalAmount: string;
  onBack: () => void;
  onChange: (field: RequestFormField, value: string) => void;
  onFileSelect: (value: string, field?: "cardReceiptName" | "contractFileName") => void;
  onSubmit: () => void;
  onInvalidSubmit: () => void;
}) {
  const config = REQUEST_FORM_CONFIGS[kind];
  const { isValid } = validateRequestForm(kind, values);
  const showError = (field: RequestFormField) => submitted && config.requiredFields.includes(field) && !values[field].trim();
  const required = (field: RequestFormField) => config.requiredFields.includes(field);
  const quantity = Number(values.quantity || 0);
  const unitPrice = Number(values.unitPrice || 0);
  const calculatedSupply = quantity * unitPrice;
  const calculatedVat = Math.floor(calculatedSupply * 0.1);
  const calculatedTotal = calculatedSupply + calculatedVat;
  const showTrackingNumber = values.trackingMatchStatus === "매칭 필요" || values.trackingMatchStatus === "확인 필요";
  const contractFileExtension = values.contractFileName.split(".").pop()?.toLowerCase();
  const invalidContractFile =
    kind === "guaranteeInsurance" &&
    Boolean(values.contractFileName.trim()) &&
    !["pdf", "jpg", "jpeg", "png"].includes(contractFileExtension ?? "");

  return (
    <section className="px-5 py-4">
      <Header title={config.title} subtitle={config.subtitle} />
      <div className="mt-[11px] rounded-lg border border-[#dce6f3] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#dce6f3] px-6 py-4">
          <div>
            <p className="text-[12px] font-[850] uppercase tracking-[0.08em] text-[#1D50A2]">VIPS Request</p>
            <h2 className="mt-1 text-[20px] font-[850] text-[#10203f]">{config.formTitle}</h2>
            <p className="mt-1 text-[13px] font-[600] text-[#5b6b84]">{config.subtitle}</p>
          </div>
          <button onClick={onBack} className="h-10 rounded-md border border-[#cfdbea] bg-white px-4 text-[13px] font-[800] text-[#31445e]">
            메인으로
          </button>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-6 px-6 py-5">
          <div>
            <div className="grid grid-cols-2 gap-5">
              <Field label="업체명" required={required("companyName")} value={values.companyName} placeholder="예: 아이씨뱅큐" error={showError("companyName")} onChange={(value) => onChange("companyName", value)} />
              {(kind === "taxInvoice") && <Field label="담당자(E메일)" required value={values.contactEmail} type="email" placeholder="sales@icbanq.com" error={showError("contactEmail")} onChange={(value) => onChange("contactEmail", value)} />}
              {(kind === "taxInvoice" || kind === "revisedTaxInvoice" || kind === "reverseIssueApproval") && <Field label={kind === "taxInvoice" ? "발행일자" : "요청일자"} required={required("issueDate")} type="date" value={values.issueDate} error={showError("issueDate")} onChange={(value) => onChange("issueDate", value)} />}
              {kind === "taxInvoice" && (
                <>
                  <Field label="품목명" required value={values.itemName} placeholder="예: 전자부품 공급" error={showError("itemName")} onChange={(value) => onChange("itemName", value)} />
                  <Field label="수량" required type="number" value={values.quantity} placeholder="0" error={showError("quantity")} onChange={(value) => onChange("quantity", value)} />
                  <Field label="단가" required type="number" value={values.unitPrice} placeholder="0" error={showError("unitPrice")} onChange={(value) => onChange("unitPrice", value)} />
                  <Field label="공급가액" value={currency(calculatedSupply)} readOnly />
                  <Field label="부가세액" value={currency(calculatedVat)} readOnly />
                  <Field label="합계액" value={currency(calculatedTotal)} readOnly />
                  <label className="block">
                    <span className="mb-2 block text-[13px] font-[800] text-[#1d2f4f]">트래킹 매칭 여부</span>
                    <select
                      value={values.trackingMatchStatus}
                      onChange={(event) => onChange("trackingMatchStatus", event.target.value)}
                      className="h-11 w-full rounded-md border border-[#cfdbea] bg-white px-3 text-[14px] font-[600] text-[#10203f] outline-none focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]"
                    >
                      <option value="">선택 안함</option>
                      <option value="매칭 필요">매칭 필요</option>
                      <option value="매칭 불필요">매칭 불필요</option>
                      <option value="확인 필요">확인 필요</option>
                    </select>
                    <p className="mt-1 text-[11px] font-[650] text-[#7a8ba4]">트래킹 매칭이 필요한 경우 선택해주세요. 정확한 출고/거래 확인을 위해 참고됩니다.</p>
                  </label>
                  {showTrackingNumber && (
                    <Field
                      label="트래킹 번호"
                      value={values.trackingNumber}
                      placeholder="Tracking Number 입력"
                      onChange={(value) => onChange("trackingNumber", value)}
                    />
                  )}
                  {values.trackingMatchStatus === "확인 필요" && (
                    <label className="block">
                      <span className="mb-2 block text-[13px] font-[800] text-[#1d2f4f]">트래킹 매칭 관련 메모</span>
                      <input
                        value={values.trackingMatchMemo}
                        onChange={(event) => onChange("trackingMatchMemo", event.target.value)}
                        placeholder="확인이 필요한 출고/거래 정보를 입력해 주세요."
                        className="h-11 w-full rounded-md border border-[#cfdbea] bg-white px-3 text-[14px] font-[600] text-[#10203f] outline-none focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]"
                      />
                    </label>
                  )}
                </>
              )}
              {kind === "revisedTaxInvoice" && (
                <>
                  <Field label="기존 세금계산서 링크" required value={values.originalInvoiceLink} placeholder="기존 세금계산서 링크 입력" error={showError("originalInvoiceLink")} onChange={(value) => onChange("originalInvoiceLink", value)} />
                  <Field label="수정사항" required value={values.revisionChange} placeholder="예: 품목명/금액/발행월 변경" error={showError("revisionChange")} onChange={(value) => onChange("revisionChange", value)} />
                  <label className="col-span-2 block">
                    <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">
                      수정이유 <span className="text-[#F39945]">*</span>
                    </span>
                    <textarea
                      value={values.revisionReason}
                      onChange={(event) => onChange("revisionReason", event.target.value)}
                      placeholder="전월 계산서 수정은 월마감 및 부가세 신고 흐름에 영향을 줄 수 있으므로 사유를 구체적으로 남겨주세요."
                      className={`h-[86px] w-full resize-none rounded-md border bg-white px-3 py-3 text-[14px] font-[600] text-[#10203f] outline-none transition placeholder:text-[#8a9bb4] focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5] ${
                        showError("revisionReason") ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea]"
                      }`}
                    />
                    {showError("revisionReason") && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </label>
                </>
              )}
              {kind === "reverseIssueApproval" && (
                <>
                  <Field label="역발행 세금계산서 사이트" required value={values.reverseIssueSite} placeholder="역발행 사이트 URL 입력" error={showError("reverseIssueSite")} onChange={(value) => onChange("reverseIssueSite", value)} />
                  <Field label="최종금액" required type="number" value={values.reverseFinalAmount} placeholder="0" error={showError("reverseFinalAmount")} onChange={(value) => onChange("reverseFinalAmount", value)} />
                  <Field label="건수" required type="number" value={values.reverseIssueCount} placeholder="요청 건수 입력" error={showError("reverseIssueCount")} onChange={(value) => onChange("reverseIssueCount", value)} />
                </>
              )}
              {kind === "advancePayment" && (
                <>
                  <label className="block">
                    <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">
                      처리 구분 <span className="text-[#F39945]">*</span>
                    </span>
                    <select
                      value={values.advanceUsageType}
                      onChange={(event) => onChange("advanceUsageType", event.target.value)}
                      className={`h-11 w-full rounded-md border bg-white px-3 text-[14px] font-[600] text-[#10203f] outline-none focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5] ${
                        showError("advanceUsageType") ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea]"
                      }`}
                    >
                      <option value="">선택해주세요</option>
                      <option value="일부사용">일부사용</option>
                      <option value="전부소진">전부소진</option>
                    </select>
                    {showError("advanceUsageType") && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </label>
                  <Field label="IKI Tax ID" required value={values.ikiTaxId} placeholder="예: TAX-20260709-001" error={showError("ikiTaxId")} onChange={(value) => onChange("ikiTaxId", value)} />
                  <Field label="선수금 링크" required value={values.advancePaymentLink} placeholder="IKI 선수금 링크" error={showError("advancePaymentLink")} onChange={(value) => onChange("advancePaymentLink", value)} />
                  <Field label="수금 링크" required value={values.advanceCollectionLink} placeholder="IKI 수금 링크" error={showError("advanceCollectionLink")} onChange={(value) => onChange("advanceCollectionLink", value)} />
                  <Field label="PO 링크" required value={values.poLink} placeholder="PO 또는 Tracking 링크" error={showError("poLink")} onChange={(value) => onChange("poLink", value)} />
                  <Field label="G/P" required type="number" value={values.gpAmount} placeholder="0" error={showError("gpAmount")} onChange={(value) => onChange("gpAmount", value)} />
                  <Field label="S/P" required type="number" value={values.spAmount} placeholder="0" error={showError("spAmount")} onChange={(value) => onChange("spAmount", value)} />
                  <Field label="U/P" required type="number" value={values.upAmount} placeholder="0" error={showError("upAmount")} onChange={(value) => onChange("upAmount", value)} />
                </>
              )}
              {kind === "cardPayment" && (
                <>
                  <Field label="결제일자" required type="date" value={values.paymentDate} error={showError("paymentDate")} onChange={(value) => onChange("paymentDate", value)} />
                  <Field label="결제금액" required type="number" value={values.paymentAmount} placeholder="0" error={showError("paymentAmount")} onChange={(value) => onChange("paymentAmount", value)} />
                  <label className="block">
                    <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">카드매출전표 업로드 <span className="text-[#F39945]">*</span></span>
                    <input
                      type="file"
                      onChange={(event) => onFileSelect(event.target.files?.[0]?.name ?? "")}
                      className={`flex h-11 w-full items-center rounded-md border bg-white px-3 text-[13px] font-[650] text-[#10203f] outline-none file:mr-3 file:rounded file:border-0 file:bg-[#edf4ff] file:px-3 file:py-1 file:text-[12px] file:font-[800] file:text-[#1D50A2] ${
                        showError("cardReceiptName") ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea]"
                      }`}
                    />
                    {values.cardReceiptName && <p className="mt-1 text-[12px] font-[750] text-[#1D50A2]">{values.cardReceiptName}</p>}
                    {showError("cardReceiptName") && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </label>
                </>
              )}
              {kind === "guaranteeInsurance" && (
                <>
                  <div className="col-span-2 rounded-lg border border-[#dce6f3] bg-[#f8fbff] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-[850] text-[#1d2f4f]">
                          요청 구분 <span className="text-[#F39945]">*</span>
                        </p>
                        <p className="mt-1 text-[12px] font-[650] text-[#5b6b84]">보증보험 요청 방식이 달라지는 핵심 분기값입니다.</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {[
                        {
                          value: "나라장터 건",
                          title: "나라장터 건",
                          description: "나라장터 제출용 보증보험 요청입니다. 나라장터 기준 계약정보와 보증기간을 정확히 확인해주세요."
                        },
                        {
                          value: "일반 계약 건",
                          title: "일반 계약 건",
                          description: "일반 계약 기준 보증보험 요청입니다. 계약서 기준 정보를 정확히 입력해주세요."
                        }
                      ].map((option) => {
                        const selected = values.guaranteeRequestType === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange("guaranteeRequestType", option.value)}
                            className={`min-h-[92px] rounded-md border px-4 py-3 text-left transition ${
                              selected
                                ? "border-[#1D50A2] bg-white shadow-[inset_0_0_0_1px_#1D50A2]"
                                : showError("guaranteeRequestType")
                                  ? "border-[#F39945] bg-[#fff5ec]"
                                  : "border-[#dce6f3] bg-white hover:border-[rgba(29,80,162,0.22)]"
                            }`}
                          >
                            <span className={`text-[14px] font-[850] ${selected ? "text-[#1D50A2]" : "text-[#10203f]"}`}>{option.title}</span>
                            <span className="mt-2 block text-[12px] font-[650] leading-5 text-[#5b6b84]">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                    {showError("guaranteeRequestType") && <p className="mt-2 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </div>
                  <label className="block">
                    <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">
                      보증보험 종류 <span className="text-[#F39945]">*</span>
                    </span>
                    <select
                      value={values.guaranteeType}
                      onChange={(event) => onChange("guaranteeType", event.target.value)}
                      className={`h-11 w-full rounded-md border bg-white px-3 text-[14px] font-[600] text-[#10203f] outline-none ${
                        showError("guaranteeType") ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea] focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]"
                      }`}
                    >
                      <option value="">선택</option>
                      <option value="계약이행">계약이행</option>
                      <option value="하자이행">하자이행</option>
                      <option value="선금이행">선금이행</option>
                    </select>
                    {showError("guaranteeType") && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </label>
                  <Field label="보증요율" required value={values.guaranteeRate} placeholder="예: 0.8% 또는 0.8" error={showError("guaranteeRate")} onChange={(value) => onChange("guaranteeRate", value)} />
                  <Field label="보증기간 시작일" required type="date" value={values.guaranteeStartDate} error={showError("guaranteeStartDate")} onChange={(value) => onChange("guaranteeStartDate", value)} />
                  <Field label="보증기간 종료일" required type="date" value={values.guaranteeEndDate} error={showError("guaranteeEndDate")} onChange={(value) => onChange("guaranteeEndDate", value)} />
                  <Field label="계약명" required value={values.contractName} placeholder="예: ICBANQ 공급 계약" error={showError("contractName")} onChange={(value) => onChange("contractName", value)} />
                  <Field label="계약금액(VAT 포함)" required type="number" value={values.contractAmount} placeholder="0" error={showError("contractAmount")} onChange={(value) => onChange("contractAmount", value)} />
                  <label className="block">
                    <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">
                      계약서 첨부 <span className="text-[#F39945]">*</span>
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(event) => onFileSelect(event.target.files?.[0]?.name ?? "", "contractFileName")}
                      className={`flex h-11 w-full items-center rounded-md border bg-white px-3 text-[13px] font-[650] text-[#10203f] outline-none file:mr-3 file:rounded file:border-0 file:bg-[#edf4ff] file:px-3 file:py-1 file:text-[12px] file:font-[800] file:text-[#1D50A2] ${
                        showError("contractFileName") ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea]"
                      }`}
                    />
                    {values.contractFileName && !invalidContractFile && <p className="mt-1 text-[12px] font-[750] text-[#1D50A2]">업로드 완료 · {values.contractFileName}</p>}
                    {invalidContractFile && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">PDF, JPG, JPEG, PNG 파일만 첨부할 수 있습니다.</p>}
                    {showError("contractFileName") && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">계약서를 첨부해야 요청 제출이 가능합니다.</p>}
                    <p className="mt-1 text-[11px] font-[650] text-[#7a8ba4]">PDF, JPG, JPEG, PNG 첨부 가능</p>
                  </label>
                </>
              )}
              {kind === "invoiceMatching" && (
                <>
                  <div className="col-span-2 rounded-lg border border-[#dce6f3] bg-[#f8fbff] p-4">
                    <p className="text-[13px] font-[850] text-[#1d2f4f]">
                      요청 유형 <span className="text-[#F39945]">*</span>
                    </p>
                    <p className="mt-1 text-[12px] font-[650] text-[#5b6b84]">계산서와 트래킹 흐름을 연결하거나 잘못된 연결을 해제합니다.</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {["계산서매칭", "계산서매칭해제"].map((option) => {
                        const selected = values.invoiceMatchType === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => onChange("invoiceMatchType", option)}
                            className={`h-[66px] rounded-md border px-4 text-left transition ${
                              selected
                                ? "border-[#1D50A2] bg-white text-[#1D50A2] shadow-[inset_0_0_0_1px_#1D50A2]"
                                : showError("invoiceMatchType")
                                  ? "border-[#F39945] bg-[#fff5ec] text-[#10203f]"
                                  : "border-[#dce6f3] bg-white text-[#10203f] hover:border-[rgba(29,80,162,0.22)]"
                            }`}
                          >
                            <span className="text-[14px] font-[850]">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                    {showError("invoiceMatchType") && <p className="mt-2 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </div>
                  <Field label="계산서 링크" required value={values.invoiceLink} placeholder="계산서 링크 입력" error={showError("invoiceLink")} onChange={(value) => onChange("invoiceLink", value)} />
                  <Field label="트래킹 링크" required value={values.trackingLink} placeholder="트래킹 링크 입력" error={showError("trackingLink")} onChange={(value) => onChange("trackingLink", value)} />
                  <label className="col-span-2 block">
                    <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">
                      요청 사유 <span className="text-[#F39945]">*</span>
                    </span>
                    <textarea
                      value={values.matchReason}
                      onChange={(event) => onChange("matchReason", event.target.value)}
                      placeholder="매칭 또는 해제가 필요한 사유를 입력해 주세요."
                      className={`h-[86px] w-full resize-none rounded-md border bg-white px-3 py-3 text-[14px] font-[600] text-[#10203f] outline-none transition placeholder:text-[#8a9bb4] focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5] ${
                        showError("matchReason") ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea]"
                      }`}
                    />
                    {showError("matchReason") && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </label>
                </>
              )}
              {kind === "collectionMatching" && (
                <>
                  <div className="col-span-2 rounded-lg border border-[#dce6f3] bg-[#f8fbff] p-4">
                    <p className="text-[13px] font-[850] text-[#1d2f4f]">
                      요청 유형 <span className="text-[#F39945]">*</span>
                    </p>
                    <p className="mt-1 text-[12px] font-[650] text-[#5b6b84]">수금과 트래킹 또는 세금계산서 흐름을 연결하거나 잘못된 연결을 해제합니다.</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {["수금매칭", "수금매칭해제"].map((option) => {
                        const selected = values.collectionMatchType === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => onChange("collectionMatchType", option)}
                            className={`h-[66px] rounded-md border px-4 text-left transition ${
                              selected
                                ? "border-[#1D50A2] bg-white text-[#1D50A2] shadow-[inset_0_0_0_1px_#1D50A2]"
                                : showError("collectionMatchType")
                                  ? "border-[#F39945] bg-[#fff5ec] text-[#10203f]"
                                  : "border-[#dce6f3] bg-white text-[#10203f] hover:border-[rgba(29,80,162,0.22)]"
                            }`}
                          >
                            <span className="text-[14px] font-[850]">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                    {showError("collectionMatchType") && <p className="mt-2 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </div>
                  <Field label="수금 링크" required value={values.collectionLink} placeholder="수금 링크 입력" error={showError("collectionLink")} onChange={(value) => onChange("collectionLink", value)} />
                  <Field label="트래킹 URL" required value={values.collectionTrackingUrl} placeholder="트래킹 URL 입력" error={showError("collectionTrackingUrl")} onChange={(value) => onChange("collectionTrackingUrl", value)} />
                  <Field label="세금계산서 링크" required value={values.collectionInvoiceLink} placeholder="세금계산서 링크 입력" error={showError("collectionInvoiceLink")} onChange={(value) => onChange("collectionInvoiceLink", value)} />
                  <label className="col-span-2 block">
                    <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">
                      요청 사유 <span className="text-[#F39945]">*</span>
                    </span>
                    <textarea
                      value={values.matchReason}
                      onChange={(event) => onChange("matchReason", event.target.value)}
                      placeholder="매칭 또는 해제가 필요한 사유를 입력해 주세요."
                      className={`h-[86px] w-full resize-none rounded-md border bg-white px-3 py-3 text-[14px] font-[600] text-[#10203f] outline-none transition placeholder:text-[#8a9bb4] focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5] ${
                        showError("matchReason") ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea]"
                      }`}
                    />
                    {showError("matchReason") && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
                  </label>
                </>
              )}
              {kind === "monthEndCheck" && (
                <Field label="월마감 확인 유형" required value={values.monthEndCase} placeholder="예: 출고O / 계산서X" error={showError("monthEndCase")} onChange={(value) => onChange("monthEndCase", value)} />
              )}
            </div>

            <label className="mt-5 block">
              <span className="mb-2 flex items-center gap-1 text-[13px] font-[800] text-[#1d2f4f]">비고 {required("note") && <span className="text-[#F39945]">*</span>}</span>
              <textarea
                value={values.note}
                onChange={(event) => onChange("note", event.target.value)}
                placeholder="VIPS팀 확인이 필요한 내용을 입력해 주세요."
                className={`h-[96px] w-full resize-none rounded-md border bg-white px-3 py-3 text-[14px] font-[600] text-[#10203f] outline-none transition placeholder:text-[#8a9bb4] focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5] ${
                  showError("note") ? "border-[#F39945] bg-[#fff5ec]" : "border-[#cfdbea]"
                }`}
              />
              {showError("note") && <p className="mt-1 text-[12px] font-[700] text-[#F39945]">누락된 필수 항목입니다.</p>}
            </label>
          </div>

          <aside className="rounded-lg border border-[#dce6f3] bg-[#f8fbff] p-4">
            <p className="text-[15px] font-[850] text-[#10203f]">요청 요약</p>
            <div className="mt-4 space-y-3 text-[13px]">
              <div className="flex justify-between gap-3"><span className="text-[#5b6b84]">요청종류</span><span className="max-w-[150px] truncate font-[800] text-[#10203f]">{config.title}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[#5b6b84]">업체명</span><span className="max-w-[150px] truncate font-[800] text-[#10203f]">{values.companyName || "-"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[#5b6b84]">상태</span><span className="font-[850] text-[#1D50A2]">요청접수</span></div>
              {submitted && !isValid && (
                <div className="mt-5 rounded-md border border-[rgba(243,153,69,0.30)] bg-[#fff5ec] px-3 py-2 text-[12px] font-[800] text-[#F39945]">
                  {kind === "guaranteeInsurance" && showError("contractFileName")
                    ? "계약서를 첨부해야 요청 제출이 가능합니다."
                    : invalidContractFile
                      ? "첨부파일 형식을 확인하세요."
                      : "누락사항을 확인하세요."}
                </div>
              )}
            </div>
            <div className="mt-6">
              <div onClick={!isValid ? onInvalidSubmit : undefined}>
                <button disabled={!isValid} onClick={onSubmit} className={`h-11 w-full rounded-md text-[14px] font-[850] ${isValid ? "bg-[#1D50A2] text-white shadow-sm" : "pointer-events-none cursor-not-allowed bg-[#d7e1ef] text-[#74849b]"}`}>
                  제출
                </button>
              </div>
              <p className="mt-3 text-center text-[12px] font-[600] leading-5 text-[#5b6b84]">필수 항목 입력 후 VIPS팀 요청으로 접수됩니다.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function HomePageContent() {
  const searchParams = useSearchParams();
  const { selectedUser: storedSelectedUser } = useSelectedUser();
  const selectedUser = getTestUser(searchParams.get("user") || storedSelectedUser.name);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [activeRequestKind, setActiveRequestKind] = useState<RequestKind>("taxInvoice");
  const [formValues, setFormValues] = useState<RequestFormValues>(initialRequestFormValues);
  const [requestItems, setRequestItems] = useState<RequestItem[]>(fallbackRequests);
  const [submitted, setSubmitted] = useState(false);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [gateBlocked, setGateBlocked] = useState(false);
  const [gateBlockedOpen, setGateBlockedOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<RequestItem | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatePoint[]>(fallbackExchangeRates);
  const [exchangeSource, setExchangeSource] = useState("fallback");
  const [exchangeMessage, setExchangeMessage] = useState("임시 환율 데이터 표시 중");
  const [latestExchangeRate, setLatestExchangeRate] = useState<ExchangeRatePoint | null>(fallbackExchangeRates[fallbackExchangeRates.length - 1]);
  const [tradeCloseSummary, setTradeCloseSummary] = useState<TradeCloseUserSummary>(
    getTradeCloseSummaryForUser(initialTradeCloseDashboard, selectedUser.name) ?? { ...emptyTradeCloseSummary, salesOwner: selectedUser.name }
  );

  useEffect(() => {
    fetchRequests()
      .then((items) => {
        if (items.length > 0) setRequestItems(items);
      })
      .catch(() => setRequestItems(fallbackRequests));
  }, []);

  useEffect(() => {
    checkMonthEndGate(selectedUser.name).then((result) => setGateBlocked(result.isBlocked));
    fetchTradeCloseDashboard(selectedUser.name)
      .then((result) => setTradeCloseSummary(result.currentUser ?? { ...emptyTradeCloseSummary, salesOwner: selectedUser.name }))
      .catch(() => setTradeCloseSummary(getTradeCloseSummaryForUser(initialTradeCloseDashboard, selectedUser.name) ?? { ...emptyTradeCloseSummary, salesOwner: selectedUser.name }));
  }, [selectedUser.name]);

  useEffect(() => {
    fetch("/api/exchange-rate", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { success?: boolean; rates?: ExchangeRatePoint[]; source?: string; latestRate?: number; baseDate?: string; message?: string; fallbackUsed?: boolean }) => {
        if (payload.success && payload.source === "exchangerate-api" && payload.rates && payload.rates.length > 0) {
          setExchangeRates(payload.rates);
          setLatestExchangeRate(payload.rates[payload.rates.length - 1]);
          setExchangeSource("exchangerate-api");
          setExchangeMessage("");
          return;
        }
        if (payload.success && payload.source === "exchangerate-api" && typeof payload.latestRate === "number") {
          const point = {
            date: payload.baseDate ? payload.baseDate.slice(5).replace("-", "/") : "",
            baseDate: payload.baseDate ?? "",
            rate: payload.latestRate
          };
          setExchangeRates([point]);
          setLatestExchangeRate(point);
          setExchangeSource("exchangerate-api");
          setExchangeMessage("");
          return;
        }
        setExchangeRates(payload.rates ?? []);
        setLatestExchangeRate((payload.rates ?? [])[payload.rates?.length ? payload.rates.length - 1 : 0] ?? null);
        setExchangeSource(payload.source ?? "fallback");
        setExchangeMessage(payload.fallbackUsed ? "임시 환율 데이터 표시 중" : payload.message ?? "수출입은행 API 응답을 확인해주세요.");
      })
      .catch(() => {
        setExchangeRates(fallbackExchangeRates);
        setLatestExchangeRate(fallbackExchangeRates[fallbackExchangeRates.length - 1]);
        setExchangeSource("fallback");
        setExchangeMessage("임시 환율 데이터 표시 중");
      });
  }, []);

  useEffect(() => {
    const requestedKind = searchParams.get("request") as RequestKind | null;
    if (requestedKind && Object.prototype.hasOwnProperty.call(REQUEST_FORM_CONFIGS, requestedKind)) {
      window.history.replaceState(null, "", "/");
      void handleRequestEntry(requestedKind, window.localStorage.getItem("icbanq.ops.selectedUser") || selectedUser.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, selectedUser.name]);

  const taxCalculation = useMemo(() => {
    const quantity = Number(formValues.quantity || 0);
    const unitPrice = Number(formValues.unitPrice || 0);
    const supply = quantity * unitPrice;
    const vat = Math.floor(supply * 0.1);
    const total = supply + vat;
    return { supply, vat, total };
  }, [formValues.quantity, formValues.unitPrice]);

  const totalAmount = useMemo(() => {
    if (activeRequestKind === "taxInvoice") return currency(taxCalculation.total);
    if (activeRequestKind === "reverseIssueApproval") return currency(Number(formValues.reverseFinalAmount || 0));
    const supply = Number(formValues.supplyAmount || 0);
    if (!supply) return "";
    return `${Math.round(supply * 1.1).toLocaleString("ko-KR")}원`;
  }, [activeRequestKind, formValues.reverseFinalAmount, formValues.supplyAmount, taxCalculation.total]);

  useEffect(() => {
    if (activeRequestKind !== "taxInvoice") return;
    setFormValues((current) => ({
      ...current,
      supplyAmount: String(taxCalculation.supply || ""),
      vatAmount: String(taxCalculation.vat || ""),
      invoiceTotalAmount: taxCalculation.total ? currency(taxCalculation.total) : ""
    }));
  }, [activeRequestKind, taxCalculation.supply, taxCalculation.vat, taxCalculation.total]);

  const { isValid } = validateRequestForm(activeRequestKind, formValues);

  const myRequestItems = useMemo(
    () =>
      requestItems.filter((item) => {
        const requester = item.requester.toLowerCase();
        return requester === selectedUser.email.toLowerCase() || requester === selectedUser.name.toLowerCase();
      }),
    [requestItems, selectedUser]
  );

  const resetForm = (kind: RequestKind) => {
    setActiveRequestKind(kind);
    setFormValues(initialRequestFormValues);
    setSubmitted(false);
  };

  const handleRequestEntry = async (kind: RequestKind, gateUserName: string = selectedUser.name) => {
    const result = await checkMonthEndGate(gateUserName);
    setGateBlocked(result.isBlocked);
    if (result.isBlocked) {
      setGateBlockedOpen(true);
      return;
    }

    resetForm(kind);
    if (kind === "revisedTaxInvoice") {
      setDialog("revisionPrecheck");
      return;
    }
    if (REQUEST_FORM_CONFIGS[kind].requiresTaxPrecheck) {
      setDialog("taxPrecheck");
      return;
    }
    setView("requestForm");
  };

  const handleInvalidSubmit = () => {
    setSubmitted(true);
    setDialog("missing");
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!isValid) {
      setDialog("missing");
      return;
    }

    const savedRequest = await saveRequest({
      kind: activeRequestKind,
      values: formValues,
      totalAmount,
      existingCount: requestItems.length,
      requester: selectedUser.email
    });

    setRequestItems((current) => [savedRequest, ...current]);
    setDialog("success");
  };

  const handleSuccessConfirm = () => {
    setDialog(null);
    setFormValues(initialRequestFormValues);
    setSubmitted(false);
    setView("dashboard");
  };

  return (
    <OpsShell>
      {view === "dashboard" ? (
        <section className="flex w-full flex-col items-center">
          <GateBanner visible={gateBlocked} />
          <Home
            userName={selectedUser.name}
            exchange={{
              rate: latestExchangeRate?.rate ?? exchangeRates[exchangeRates.length - 1]?.rate,
              baseDate: latestExchangeRate?.baseDate ?? exchangeRates[exchangeRates.length - 1]?.baseDate,
              isLive: exchangeSource === "exchangerate-api",
              sourceLabel: exchangeSource === "exchangerate-api" ? "ExchangeRate API" : "수동 기준값",
              history: exchangeRates.map((point) => ({ date: point.date, rate: point.rate }))
            }}
            onSelectRequestKind={handleRequestEntry}
          />
        </section>
      ) : (
        <VipsRequestForm
          kind={activeRequestKind}
          values={formValues}
          submitted={submitted}
          totalAmount={totalAmount}
          onBack={() => setView("dashboard")}
          onChange={(field, value) => setFormValues((current) => ({ ...current, [field]: value }))}
          onFileSelect={(value, field = "cardReceiptName") => setFormValues((current) => ({ ...current, [field]: value }))}
          onSubmit={handleSubmit}
          onInvalidSubmit={handleInvalidSubmit}
        />
      )}

      <InfoDialog
        type={dialog}
        onCancel={() => setDialog(null)}
        onConfirm={dialog === "taxPrecheck" || dialog === "revisionPrecheck" ? () => { setDialog(null); setView("requestForm"); } : dialog === "success" ? handleSuccessConfirm : () => setDialog(null)}
      />
      <BlockedGateDialog open={gateBlockedOpen} onClose={() => setGateBlockedOpen(false)} />
      <RequestDetailModal request={detailRequest} onClose={() => setDetailRequest(null)} />
    </OpsShell>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}


