import { wikiArticles, wikiCategoryLabels, type WikiCategory } from "./wikiArticles";

export type GlobalSearchType = "education" | "faq" | "opsGuide" | "monthClose" | "collection" | "request" | "mistake" | "glossary";

export type GlobalSearchItem = {
  id: string;
  type: GlobalSearchType;
  title: string;
  description: string;
  keywords: string[];
  route: string;
  categoryLabel: string;
  iconLabel: string;
  tags?: string[];
  readTime?: string;
};

const categorySearchMeta: Record<WikiCategory, { type: GlobalSearchType; iconLabel: string }> = {
  iki: { type: "education", iconLabel: "📘" },
  ops: { type: "opsGuide", iconLabel: "🧭" },
  tax: { type: "education", iconLabel: "📘" },
  faq: { type: "faq", iconLabel: "❓" },
  mistake: { type: "mistake", iconLabel: "⚠️" },
  glossary: { type: "glossary", iconLabel: "🔎" }
};

const wikiSearchIndex: GlobalSearchItem[] = wikiArticles.map((article) => {
  const meta = categorySearchMeta[article.category];
  const sectionKeywords = article.sections.flatMap((section) => [section.heading, ...section.body]);
  return {
    id: `wiki-${article.id}`,
    type: meta.type,
    title: article.title,
    description: article.description,
    keywords: [article.title, article.description, wikiCategoryLabels[article.category], ...article.tags, ...sectionKeywords],
    route: `/guide?article=${article.id}`,
    categoryLabel: wikiCategoryLabels[article.category],
    iconLabel: meta.iconLabel,
    tags: article.tags,
    readTime: article.readTime
  };
});

const menuSearchIndex: GlobalSearchItem[] = [
  {
    id: "education-tax-revise",
    type: "education",
    title: "수정세금계산서는 언제 사용하나요?",
    description: "전월 계산서 수정, 수정 사유, 월마감 영향도를 확인합니다.",
    keywords: ["수정세금계산서", "수정발행", "전월", "계산서", "부가세", "수정"],
    route: "/guide?topic=tax-revise",
    categoryLabel: "교육센터",
    iconLabel: "📘"
  },
  {
    id: "request-revised-tax",
    type: "request",
    title: "수정세금계산서 요청하기",
    description: "기존 계산서 링크, 수정사항, 수정이유를 입력해 요청합니다.",
    keywords: ["수정세금계산서", "수정발행", "VIPS", "요청", "계산서"],
    route: "/requests/revisedTaxInvoice",
    categoryLabel: "VIPS 요청",
    iconLabel: "📝"
  },
  {
    id: "month-invoice-required",
    type: "monthClose",
    title: "계산서 발행 필요 거래",
    description: "출고 완료 후 계산서가 아직 발행되지 않은 월마감 이슈입니다.",
    keywords: ["월마감", "계산서", "발행", "출고O", "계산서X", "수정세금계산서"],
    route: "/month-end?filter=invoice_required",
    categoryLabel: "월마감 체크",
    iconLabel: "📊"
  },
  {
    id: "faq-revised-tax",
    type: "faq",
    title: "수정세금계산서 자주 묻는 질문",
    description: "수정발행 기준과 반려가 자주 발생하는 포인트를 확인합니다.",
    keywords: ["수정세금계산서", "FAQ", "수정발행", "반려", "전월"],
    route: "/guide?topic=tax-revise",
    categoryLabel: "FAQ",
    iconLabel: "❓"
  },
  {
    id: "collection-payment-check",
    type: "collection",
    title: "입금 확인 필요한 거래",
    description: "미수, 부분수금, 입금자명 매칭 이슈를 확인합니다.",
    keywords: ["입금확인", "입금", "수금", "수금관리", "미수", "부분수금"],
    route: "/collections?focus=payment_check",
    categoryLabel: "수금관리",
    iconLabel: "📊"
  },
  {
    id: "education-payment-check",
    type: "education",
    title: "입금확인은 언제 요청하나요?",
    description: "입금자명, 입금일자, 금액을 확인하는 기본 흐름입니다.",
    keywords: ["입금확인", "입금", "수금", "계좌", "입금자명"],
    route: "/guide?topic=iki-payment",
    categoryLabel: "교육센터",
    iconLabel: "📘"
  },
  {
    id: "faq-payment-check",
    type: "faq",
    title: "입금확인이 안 될 때",
    description: "입금자명과 거래처명이 다를 때 확인하는 순서입니다.",
    keywords: ["입금확인", "FAQ", "입금자명", "미확인", "수금"],
    route: "/guide?topic=faq-payment",
    categoryLabel: "FAQ",
    iconLabel: "❓"
  },
  {
    id: "education-deduct",
    type: "education",
    title: "Deduct란 무엇인가요?",
    description: "차감/공제가 거래 종료와 월마감에 미치는 영향을 이해합니다.",
    keywords: ["Deduct", "deduct", "차감", "공제", "월마감"],
    route: "/guide?topic=tax-deduct",
    categoryLabel: "교육센터",
    iconLabel: "📘"
  },
  {
    id: "month-deduct",
    type: "monthClose",
    title: "Deduct 확인 필요 거래",
    description: "차감/공제 금액이 남아 있는 월마감 확인 대상입니다.",
    keywords: ["Deduct", "deduct", "차감", "공제", "월마감"],
    route: "/month-end?filter=deduct_check",
    categoryLabel: "월마감 체크",
    iconLabel: "📊"
  },
  {
    id: "ops-month-end",
    type: "opsGuide",
    title: "월마감 체크 활용법",
    description: "ERP 데이터를 OPS 행동 목록으로 바꿔 확인하는 방법입니다.",
    keywords: ["월마감", "월마감 체크", "거래 종료", "Gatekeeper", "OPS"],
    route: "/guide?topic=ops-month-end",
    categoryLabel: "OPS 운영가이드",
    iconLabel: "🧭"
  },
  {
    id: "ops-collections",
    type: "opsGuide",
    title: "수금관리 활용법",
    description: "미수, 부분수금, 입금자명 매칭 이슈를 우선순위대로 처리합니다.",
    keywords: ["수금관리", "수금", "부분수금", "미수", "입금자명"],
    route: "/guide?topic=ops-collections",
    categoryLabel: "OPS 운영가이드",
    iconLabel: "🧭"
  },
  {
    id: "request-tax-invoice",
    type: "request",
    title: "세금계산서 발행 요청하기",
    description: "품목, 수량, 단가를 입력하고 공급가액/VAT를 확인합니다.",
    keywords: ["세금계산서", "계산서", "발행", "요청", "VAT", "부가세"],
    route: "/requests/taxInvoice",
    categoryLabel: "VIPS 요청",
    iconLabel: "📝"
  },
  {
    id: "request-advance-payment",
    type: "request",
    title: "선수금 처리 요청하기",
    description: "선수금 일부사용 또는 전부소진 처리를 위해 IKI Tax ID와 관련 링크를 남깁니다.",
    keywords: ["선수금", "입금", "요청", "일부사용", "전부소진", "IKI Tax ID"],
    route: "/requests/advancePayment",
    categoryLabel: "VIPS 요청",
    iconLabel: "📝"
  },
  {
    id: "request-insurance",
    type: "request",
    title: "보증보험 요청하기",
    description: "계약서와 계약금액을 기준으로 보증보험을 요청합니다.",
    keywords: ["보증보험", "계약이행", "하자이행", "선금이행", "요청"],
    route: "/requests/guaranteeInsurance",
    categoryLabel: "VIPS 요청",
    iconLabel: "📝"
  },
  {
    id: "request-invoice-match",
    type: "request",
    title: "계산서매칭 요청하기",
    description: "계산서와 트래킹 흐름을 연결하거나 해제합니다.",
    keywords: ["계산서매칭", "매칭", "계산서", "트래킹", "해제"],
    route: "/requests/invoiceMatching",
    categoryLabel: "VIPS 요청",
    iconLabel: "📝"
  },
  {
    id: "request-collection-match",
    type: "request",
    title: "수금매칭 요청하기",
    description: "입금 흐름과 거래/세금계산서 흐름을 연결합니다.",
    keywords: ["수금매칭", "수금", "매칭", "입금", "해제"],
    route: "/requests/collectionMatching",
    categoryLabel: "VIPS 요청",
    iconLabel: "📝"
  },
  {
    id: "month-shipment-check",
    type: "monthClose",
    title: "출고 확인 필요 거래",
    description: "입고 이후 출고 흐름이 아직 닫히지 않은 거래를 확인합니다.",
    keywords: ["출고", "출고확인", "월마감", "입고O", "출고X"],
    route: "/month-end?filter=shipment_check",
    categoryLabel: "월마감 체크",
    iconLabel: "📊"
  },
  {
    id: "month-long-pending",
    type: "monthClose",
    title: "장기 미진행 거래",
    description: "입고 후 출고/계산서 흐름이 오래 멈춘 거래입니다.",
    keywords: ["장기미진행", "미진행", "월마감", "입고", "출고"],
    route: "/month-end?filter=long_pending",
    categoryLabel: "월마감 체크",
    iconLabel: "📊"
  }
];

export const searchIndex: GlobalSearchItem[] = [...wikiSearchIndex, ...menuSearchIndex];

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function scoreItem(item: GlobalSearchItem, normalizedQuery: string) {
  const title = normalizeSearchText(item.title);
  const description = normalizeSearchText(item.description);
  const keywords = item.keywords.map(normalizeSearchText);
  let score = 0;

  if (title === normalizedQuery) score += 100;
  if (title.startsWith(normalizedQuery)) score += 60;
  if (title.includes(normalizedQuery)) score += 45;
  if (keywords.some((keyword) => keyword === normalizedQuery)) score += 70;
  if (keywords.some((keyword) => keyword.includes(normalizedQuery) || normalizedQuery.includes(keyword))) score += 35;
  if (description.includes(normalizedQuery)) score += 18;

  return score;
}

export function searchGlobal(query: string, limit = 8) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return [];

  return searchIndex
    .map((item) => ({ item, score: scoreItem(item, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "ko"))
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function routeWithUser(route: string, userName?: string) {
  if (!userName) return route;
  const [path, query = ""] = route.split("?");
  const params = new URLSearchParams(query);
  params.set("user", userName);
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}
