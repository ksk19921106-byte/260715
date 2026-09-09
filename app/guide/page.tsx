"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  HelpCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { ModulePage } from "@/app/components/ModulePage";
import { wikiArticles, wikiCategoryLabels, type WikiArticle } from "../services/wikiArticles";

type HelpCategory = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: "blue" | "orange" | "red" | "green";
  keywords: string[];
};

const helpCategories: HelpCategory[] = [
  {
    id: "tax",
    label: "세금계산서",
    description: "발행, 수정, 역발행, 가상계산서",
    icon: FileText,
    tone: "orange",
    keywords: ["세금계산서", "계산서", "수정세금계산서", "역발행", "가상계산서", "부가세", "tax"]
  },
  {
    id: "collection",
    label: "수금",
    description: "입금확인, 수금매칭, 부분입금, AR",
    icon: WalletCards,
    tone: "green",
    keywords: ["수금", "입금", "수금매칭", "부분입금", "미수", "ar", "collect"]
  },
  {
    id: "shipping",
    label: "출고",
    description: "출고요청, 퀵배송, 선출고",
    icon: Truck,
    tone: "blue",
    keywords: ["출고", "선출고", "퀵배송", "배송", "arrange", "shipment"]
  },
  {
    id: "month-end",
    label: "월마감",
    description: "미종료 거래, Deduct, Gatekeeper",
    icon: CheckCircle2,
    tone: "red",
    keywords: ["월마감", "마감", "deduct", "gatekeeper", "미종료", "차감"]
  },
  {
    id: "rma",
    label: "반품",
    description: "RMA, 반품, 교환 처리",
    icon: RotateCcw,
    tone: "orange",
    keywords: ["rma", "반품", "교환", "return"]
  },
  {
    id: "contract",
    label: "계약",
    description: "보증보험, 여신, 승인",
    icon: ShieldCheck,
    tone: "blue",
    keywords: ["보증보험", "계약", "여신", "한도", "승인", "credit", "hold"]
  },
  {
    id: "glossary",
    label: "회사 용어",
    description: "AR, Billing, GP, COC, MOQ",
    icon: BookOpenCheck,
    tone: "green",
    keywords: ["ar", "ap", "gp", "billing", "deduct", "coc", "moq", "용어"]
  },
  {
    id: "mistake",
    label: "실수 사례",
    description: "반려, 누락, 지연, 재확인",
    icon: AlertTriangle,
    tone: "red",
    keywords: ["실수", "사례", "반려", "누락", "지연", "잘못"]
  },
  {
    id: "ops",
    label: "운영 가이드",
    description: "Home, 요청, Gatekeeper, OPS 흐름",
    icon: BriefcaseBusiness,
    tone: "blue",
    keywords: ["ops", "운영", "home", "요청", "gatekeeper", "가이드"]
  },
  {
    id: "faq",
    label: "자주 묻는 질문",
    description: "안됨, 왜, 어떻게, 확인",
    icon: HelpCircle,
    tone: "green",
    keywords: ["faq", "반려", "안됨", "왜", "누락", "확인", "문의"]
  }
];

const quickChips = ["출고 안돼요", "입금 들어왔는데", "계산서 왜 안 끊겨요", "수금매칭", "COC", "선출고", "Deduct", "여신 막혔어요", "RMA"];

const primaryCategoryIds = ["shipping", "tax", "collection", "month-end", "contract", "faq"];

const situationCards = [
  { title: "출고가 막혔어요", query: "출고 안돼요", hint: "여신, 선출고, 퀵배송부터 확인" },
  { title: "입금은 됐는데 다음이 막혀요", query: "입금 들어왔는데", hint: "입금확인, 수금매칭, AR 확인" },
  { title: "계산서 처리가 헷갈려요", query: "계산서 왜 안 끊겨요", hint: "발행 기준, 수정, 매칭 확인" },
  { title: "월마감에 계속 남아요", query: "월마감", hint: "출고/계산서/수금 흐름 확인" }
];

const situationIntents = [
  { words: ["출고 안", "출고안", "출고가 안", "배송 안", "출고 막"], boost: ["출고", "선출고", "여신", "승인", "퀵배송"] },
  { words: ["입금", "돈 들어", "수금", "부분입금", "미수"], boost: ["입금확인", "수금매칭", "AR", "부분입금", "수금"] },
  { words: ["계산서", "안 끊", "발행", "수정세금", "역발행"], boost: ["세금계산서", "수정세금계산서", "가상계산서", "계산서매칭"] },
  { words: ["반려", "거절", "다시", "수정"], boost: ["반려", "수정", "요청", "체크포인트"] },
  { words: ["여신", "한도", "선입", "승인"], boost: ["여신", "선출고", "한도", "승인"] }
];

const titleOverrides: Record<string, string> = {
  "iki-arrange": "출고 요청하기",
  "iki-quick-delivery-approval": "퀵배송 승인받기",
  "iki-tracking-search": "Tracking에서 거래 찾기",
  "iki-tracking-tax-issue": "세금계산서 발행하기",
  "iki-advance-shipment": "선출고 승인받기",
  "iki-collect-money": "수금매칭하기",
  "iki-rma": "RMA 처리하기",
  "iki-coc": "COC 작성하기",
  "iki-order-split": "Order 분할하기",
  "iki-month-end-write": "월마감 의견 작성하기",
  "iki-credit-request": "여신 신청하기"
};

const toneStyle = {
  blue: "bg-[#edf4ff] text-[#1D50A2]",
  orange: "bg-[#fff5ec] text-[#F39945]",
  red: "bg-[#fff5ec] text-[#F39945]",
  green: "bg-[#edf4ff] text-[#1D50A2]"
};

function textOf(article: WikiArticle) {
  return [
    article.title,
    article.description,
    article.category,
    ...article.tags,
    ...article.sections.flatMap((section) => [section.heading, ...section.body])
  ]
    .join(" ")
    .toLowerCase();
}

function displayTitle(article: WikiArticle) {
  return titleOverrides[article.id] ?? article.title;
}

function sectionBody(article: WikiArticle, includes: string[]) {
  const found = article.sections.find((section) => includes.some((word) => section.heading.includes(word)));
  return found?.body.filter(Boolean) ?? [];
}

function cleanLine(line: string) {
  return line
    .replace(/^[□×✔✓•\-\s]+/, "")
    .replace(/^①|^②|^③|^④|^⑤|^⑥/g, "")
    .trim();
}

function compactLines(lines: string[], limit = 4) {
  return lines.map(cleanLine).filter(Boolean).slice(0, limit);
}

function categoryOf(article: WikiArticle) {
  const haystack = textOf(article);
  return helpCategories.find((category) => category.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())));
}

function searchArticles(query: string, selectedCategory: string) {
  const normalized = query.trim().toLowerCase();
  const activeCategory = helpCategories.find((category) => category.id === selectedCategory);

  return wikiArticles
    .filter((article) => {
      const haystack = textOf(article);
      const categoryMatch = !activeCategory || activeCategory.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
      if (!normalized) return categoryMatch;
      const boosts = situationIntents
        .filter((intent) => intent.words.some((word) => normalized.includes(word.toLowerCase())))
        .flatMap((intent) => intent.boost);
      return categoryMatch && (haystack.includes(normalized) || boosts.some((word) => haystack.includes(word.toLowerCase())));
    })
    .map((article) => {
      const haystack = textOf(article);
      const intentScore = situationIntents.reduce((score, intent) => {
        const matched = intent.words.some((word) => normalized.includes(word.toLowerCase()));
        if (!matched) return score;
        return score + intent.boost.filter((word) => haystack.includes(word.toLowerCase())).length * 5;
      }, 0);
      const titleScore = displayTitle(article).toLowerCase().includes(normalized) ? 20 : 0;
      const tagScore = article.tags.some((tag) => tag.toLowerCase().includes(normalized)) ? 10 : 0;
      return { article, score: intentScore + titleScore + tagScore };
    })
    .sort((a, b) => b.score - a.score || displayTitle(a.article).localeCompare(displayTitle(b.article), "ko"))
    .slice(0, 12)
    .map(({ article }) => article);
}

function blockedCases(article: WikiArticle) {
  const mistakes = compactLines(sectionBody(article, ["자주 하는 실수", "실수"]), 2);
  const checks = compactLines(sectionBody(article, ["체크포인트", "확인"]), 2);
  const tip = compactLines(sectionBody(article, ["VIPS TIP", "TIP"]), 1)[0];
  const source = [...mistakes, ...checks].filter(Boolean).slice(0, 3);
  const lines = source.length ? source : ["거래 상태가 맞지 않아 다음 단계로 넘어가지 않습니다."];

  return lines.map((issue) => {
    let answer = "상태, 금액, 거래처를 먼저 대조하세요.";
    if (issue.includes("계산서")) answer = "발행 기준, 영수/청구, 거래처 정보를 확인하세요.";
    if (issue.includes("입금") || issue.includes("수금")) answer = "입금자명, 금액, 입금일을 대조하세요.";
    if (issue.includes("출고") || issue.includes("여신") || issue.includes("승인")) answer = "여신 승인, 한도, 승인 완료 여부를 먼저 보세요.";
    if (issue.includes("메일") || issue.includes("이메일")) answer = "메일 발송 체크와 수신 이메일을 확인하세요.";
    return { issue, answer };
  }).concat(tip ? [{ issue: "꼭 기억할 것", answer: tip }] : []);
}

function relatedArticles(article: WikiArticle) {
  const byId = new Map(wikiArticles.map((item) => [item.id, item]));
  const explicit = (article.relatedArticleIds ?? []).map((id) => byId.get(id)).filter(Boolean) as WikiArticle[];
  if (explicit.length >= 4) return explicit.slice(0, 5);

  const category = categoryOf(article);
  const fallback = wikiArticles
    .filter((item) => item.id !== article.id)
    .filter((item) => {
      if (!category) return item.category === article.category;
      const haystack = textOf(item);
      return category.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    })
    .slice(0, 5);
  return [...explicit, ...fallback.filter((item) => !explicit.some((rel) => rel.id === item.id))].slice(0, 5);
}

function ScreenshotBlock({ article, index }: { article: WikiArticle; index: 1 | 2 }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#e5edf7] bg-[#f8fbff]">
      {!failed ? (
        // 실제 IKI 캡처가 추가되면 같은 파일명 규칙으로 바로 표시됩니다.
        <img
          src={`/assets/wiki/${article.id}-screen-${index}.png`}
          alt={`${displayTitle(article)} 화면 ${index}`}
          className="h-[180px] w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-[180px] items-center justify-center bg-white text-[12px] font-[850] text-[#94a3b8]">
          실제 화면 캡처 준비 중
        </div>
      )}
      <p className="px-4 py-3 text-[12px] font-[750] leading-5 text-[#64748b]">화면에서는 선택값과 저장 여부만 빠르게 확인하세요.</p>
    </div>
  );
}

function SolutionArticle({ article, onPick }: { article: WikiArticle; onPick: (article: WikiArticle) => void }) {
  const useCase = compactLines(sectionBody(article, ["언제 사용하는"]), 1)[0] ?? article.description;
  const flow = compactLines(sectionBody(article, ["처리 순서", "사용 방법"]), 6);
  const blockers = blockedCases(article);
  const related = relatedArticles(article);

  return (
    <article className="min-w-0 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef2f7] pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">FAST SOLUTION</p>
          <h2 className="mt-1 text-[22px] font-[950] tracking-[-0.02em] text-[#111827]">{displayTitle(article)}</h2>
          <p className="mt-1 max-w-[760px] text-[13px] font-[750] leading-5 text-[#64748b]">{article.description}</p>
        </div>
        <span className="rounded-full bg-[#edf4ff] px-3 py-1.5 text-[12px] font-[950] text-[#1D50A2]">{wikiCategoryLabels[article.category]}</span>
      </div>

      <div className="mt-4 grid gap-4">
        <section>
          <h3 className="text-[15px] font-[950] text-[#111827]">언제 사용하는 업무인가</h3>
          <p className="mt-2 rounded-[16px] border border-[#e5edf7] bg-[#f8fbff] px-4 py-3 text-[14px] font-[800] leading-6 text-[#334155]">{useCase}</p>
        </section>

        <section>
          <h3 className="text-[15px] font-[950] text-[#111827]">바로 해결하기</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(flow.length ? flow : ["메뉴 진입", "대상 확인", "필수값 입력", "저장", "완료"]).map((step, index, arr) => (
              <div key={`${step}-${index}`} className="flex items-center gap-2">
                <span className="rounded-full border border-[#dbe7f5] bg-white px-3 py-2 text-[12px] font-[900] text-[#1f2937]">{step}</span>
                {index < arr.length - 1 ? <ArrowRight className="h-4 w-4 text-[#94a3b8]" /> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-[#f7c999] bg-[#fff5ec] p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#F39945]" />
            <h3 className="text-[15px] font-[950] text-[#111827]">가장 많이 막히는 경우</h3>
          </div>
          <div className="mt-3 grid gap-2">
            {blockers.map((item) => (
              <div key={`${item.issue}-${item.answer}`} className="rounded-[14px] bg-white/80 px-3 py-2">
                <p className="text-[13px] font-[900] text-[#111827]">{item.issue}</p>
                <p className="mt-1 text-[12px] font-[750] text-[#64748b]">→ {item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[15px] font-[950] text-[#111827]">관련 문서</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {related.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                className="rounded-full border border-[#dbe7f5] bg-white px-3 py-2 text-[12px] font-[900] text-[#334155] transition hover:border-[#1D50A2] hover:text-[#1D50A2]"
              >
                {displayTitle(item)}
              </button>
            ))}
            {article.relatedRoutes?.map((route) => (
              <Link key={route.path} href={route.path} className="rounded-full bg-[#edf4ff] px-3 py-2 text-[12px] font-[950] text-[#1D50A2] transition hover:bg-[#dbeafe]">
                {route.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

export default function GuidePage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("shipping");
  const initialArticle = wikiArticles.find((article) => article.id === "iki-tracking-tax-issue") ?? wikiArticles[0];
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(initialArticle);

  const results = useMemo(() => searchArticles(query, selectedCategory), [query, selectedCategory]);
  const visibleResults = (results.length ? results : wikiArticles.slice(0, 10)).slice(0, query.trim() ? 10 : 8);

  const handleCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setQuery("");
    const first = searchArticles("", categoryId)[0];
    if (first) setSelectedArticle(first);
  };

  return (
    <ModulePage
      eyebrow="OPS HELP CENTER"
      title="업무 해결센터"
      description="막힌 업무를 30초 안에 찾고 바로 처리하는 ICBANQ OPS 문제 해결 허브입니다."
    >
      <div className="mt-5 space-y-4">
        <section className="ops-card overflow-hidden p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">SEARCH FIRST</p>
              <h2 className="mt-1 text-[24px] font-[950] tracking-[-0.03em] text-[#111827]">무엇이 막혔나요?</h2>
              <p className="mt-1 text-[13px] font-[750] leading-5 text-[#64748b]">상황을 입력하면 바로 해결 문서를 찾아드립니다.</p>
            </div>
            <div className="flex h-12 min-w-0 items-center gap-3 rounded-full border border-[#d6e3f5] bg-[#fbfdff] px-4 lg:w-[560px]">
              <Search className="h-5 w-5 shrink-0 text-[#1D50A2]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="예: 출고 안돼요, 입금 들어왔는데, 계산서 왜 안 끊겨요"
                className="min-w-0 flex-1 bg-transparent text-[14px] font-[800] text-[#111827] outline-none placeholder:text-[#94a3b8]"
              />
            </div>
          </div>
          <div className="mt-3 flex max-h-[72px] flex-wrap gap-2 overflow-hidden">
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setQuery(chip)}
                className="rounded-full bg-[#f1f5f9] px-3 py-1.5 text-[12px] font-[900] text-[#475569] transition hover:bg-[#edf4ff] hover:text-[#1D50A2]"
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {helpCategories.filter((category) => primaryCategoryIds.includes(category.id)).map((category) => {
            const Icon = category.icon;
            const active = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategory(category.id)}
                className={`ops-card min-w-0 p-4 text-left transition hover:-translate-y-0.5 ${active ? "border-[#1D50A2] bg-[#f8fbff]" : ""}`}
              >
                <div className={`ops-icon-circle ${toneStyle[category.tone]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[15px] font-[950] text-[#111827]">{category.label}</p>
                <p className="mt-1 line-clamp-2 text-[12px] font-[750] leading-5 text-[#64748b]">{category.description}</p>
              </button>
            );
          })}
        </section>

        <section className="ops-card min-w-0 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">SOLUTION LIST</p>
                <h3 className="mt-1 text-[20px] font-[950] text-[#111827]">관련 질문</h3>
              </div>
            </div>
            <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-[12px] font-[950] text-[#1D50A2]">{visibleResults.length}개</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-[18px] border border-[#e5edf7] bg-white">
              {visibleResults.map((article) => {
                const active = selectedArticle?.id === article.id;
                const category = categoryOf(article);
                return (
                  <div
                    key={article.id}
                    className={`border-t border-[#eef2f7] first:border-t-0 ${active ? "bg-[#f8fbff]" : "bg-white"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedArticle((current) => (current?.id === article.id ? null : article))}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#f8fbff]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[16px] font-[950] text-[#111827]">{displayTitle(article)}</p>
                          <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-[900] text-[#64748b]">
                            {category?.label ?? wikiCategoryLabels[article.category]}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-[12px] font-[750] text-[#64748b]">{article.description}</p>
                      </div>
                      <ArrowRight className={`h-5 w-5 shrink-0 text-[#94a3b8] transition ${active ? "rotate-90 text-[#1D50A2]" : ""}`} />
                    </button>
                    {active ? (
                      <div className="border-t border-[#e5edf7] bg-[#fbfdff] p-4">
                        <SolutionArticle article={article} onPick={setSelectedArticle} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
        </section>
      </div>
    </ModulePage>
  );
}


