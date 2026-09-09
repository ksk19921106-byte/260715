export type WikiCategory = "iki" | "ops" | "tax" | "faq" | "mistake" | "glossary";

export type WikiArticle = {
  id: string;
  category: WikiCategory;
  title: string;
  description: string;
  tags: string[];
  level: "기본" | "중급" | "필수";
  readTime: string;
  target: "신입" | "Sales 전체" | "관리자";
  sections: {
    heading: string;
    body: string[];
  }[];
  checklist?: string[];
  mistakes?: string[];
  tips?: string[];
  relatedArticleIds?: string[];
  relatedRoutes?: {
    label: string;
    path: string;
  }[];
  status?: "published" | "draft" | "comingSoon";
  updatedAt: string;
  version: string;
};

const updatedAt = "2026.06.25";

const route = {
  monthEnd: { label: "월마감 체크", path: "/month-end" },
  collections: { label: "수금관리", path: "/collections" },
  requests: { label: "VIPS팀 요청", path: "/requests" },
  requestStatus: { label: "나의 요청현황", path: "/request-status" }
};

type ArticleSeed = {
  id: string;
  category: WikiCategory;
  title: string;
  description: string;
  tags: string[];
  level?: WikiArticle["level"];
  readTime?: string;
  use: string[];
  frequent: string[];
  process: string[];
  checks: string[];
  mistakes: string[];
  tip: string[];
  relatedArticleIds?: string[];
  relatedRoutes?: WikiArticle["relatedRoutes"];
  status?: WikiArticle["status"];
};

function ikiSeed(
  id: string,
  title: string,
  description: string,
  use: string[],
  frequent: string[],
  process: string[],
  checks: string[],
  mistakes: string[],
  tip: string[],
  relatedArticleIds: string[] = ["iki-tracking", "ops-month-end", "ops-request"]
): ArticleSeed {
  return {
    id,
    category: "iki",
    title,
    description,
    tags: ["IKI", ...title.split(" ").slice(0, 3)],
    level: "필수",
    readTime: "3분",
    use,
    frequent,
    process,
    checks: checks.map((item) => `□ ${item}`),
    mistakes: mistakes.map((item) => `× ${item}`),
    tip,
    relatedArticleIds,
    relatedRoutes: [route.monthEnd, route.collections, route.requests]
  };
}

const trackingManualSeeds: ArticleSeed[] = [
  ikiSeed(
    "iki-arrange",
    "Tracking 출고 요청 Arrange",
    "Tracking에서 일반 출고, 택배 출고, 계산서 동봉을 요청하는 기능입니다.",
    ["출고 요청이 필요한 경우 사용합니다.", "고객에게 제품을 보내야 하고 배송방법, 계산서 형태, 연락처를 함께 지정해야 할 때 사용합니다."],
    ["일반 출고", "택배 출고", "계산서 동봉", "계산서 메일 발송"],
    ["출고 품목을 선택합니다.", "우클릭 후 출고요청을 선택합니다.", "배송방법을 선택합니다.", "계산서 형태를 영수 또는 미발행 중 선택합니다.", "박스동봉 또는 메일발송 여부를 선택합니다.", "계산서 발송 이메일을 확인합니다.", "연락처와 SMS 내용을 입력합니다.", "Confirm을 누릅니다."],
    ["계산서 형태 확인", "이메일 확인", "연락처 확인", "박스동봉 여부 확인"],
    ["계산서 형태를 잘못 선택함", "이메일을 누락함", "연락처를 입력하지 않음"],
    ["출고 요청 전 계산서 발행 여부를 먼저 확인하면 월마감 누락을 줄일 수 있습니다."],
    ["iki-shipment", "tax-issue-timing", "ops-month-end"]
  ),
  ikiSeed(
    "iki-quick-delivery-approval",
    "Tracking 퀵배송 승인",
    "긴급 출고를 위해 퀵배송 승인 링크를 생성하고 팀장 승인을 요청하는 기능입니다.",
    ["긴급 출고가 필요한 경우 사용합니다.", "일반 배송으로는 납기를 맞추기 어려울 때 사용합니다."],
    ["고객 긴급 납기", "당일 출고 요청", "프로젝트 일정 지연 방지"],
    ["제품을 선택합니다.", "퀵배송을 선택합니다.", "긴급 사유를 입력합니다.", "Confirm을 누릅니다.", "생성된 승인 링크를 복사합니다.", "Teams로 팀장 승인 요청을 보냅니다.", "최종 승인 완료 여부를 확인합니다."],
    ["긴급 사유 작성", "승인 링크 복사", "팀장 승인 완료 여부 확인"],
    ["사유를 짧게만 입력함", "승인 요청만 보내고 완료 여부를 확인하지 않음", "승인 전 출고 완료로 착각함"],
    ["승인 요청은 등록이 끝이 아닙니다. 최종 승인 완료까지 확인해야 합니다."],
    ["iki-arrange", "iki-shipment", "ops-request-status"]
  ),
  ikiSeed(
    "iki-tracking-search",
    "Tracking 검색",
    "업체명, 고객명, P/N, BOM 프로젝트명으로 거래를 찾는 기능입니다.",
    ["Tracking 번호를 모를 때 거래를 찾기 위해 사용합니다.", "고객 문의나 VIPS 요청 전 거래 링크를 찾을 때 사용합니다."],
    ["업체명 검색", "고객명 검색", "P/N 검색", "프로젝트명 BOM 검색"],
    ["알고 있는 검색어를 입력합니다.", "업체명 또는 고객명 결과를 먼저 확인합니다.", "프로젝트 건은 BOM 기준으로 검색합니다.", "거래처와 품목이 맞는 Tracking을 선택합니다."],
    ["거래처명 확인", "고객명 확인", "P/N 확인", "BOM 프로젝트명 확인"],
    ["비슷한 거래처를 잘못 선택함", "BOM으로 검색해야 하는데 업체명만 검색함", "P/N만 보고 다른 거래를 선택함"],
    ["프로젝트 건은 BOM으로 검색하는 경우가 많습니다. 검색어를 하나만 고집하지 마세요."],
    ["iki-tracking", "ops-invoice-match", "ops-collection-match"]
  ),
  ikiSeed(
    "iki-tracking-tax-issue",
    "Tracking 계산서 발행",
    "Tracking 품목을 기준으로 세금계산서와 거래명세서를 발행하는 기능입니다.",
    ["출고 후 계산서 발행이 필요한 경우 사용합니다.", "월마감에서 출고O/계산서X 이슈가 보일 때 확인합니다."],
    ["선입 거래 영수 발행", "여신 거래 청구 발행", "세금계산서 + 거래명세서 발행"],
    ["품목을 선택합니다.", "계산서 발행을 선택합니다.", "발행 목록을 선택합니다.", "세금계산서 + 거래명세서를 선택합니다.", "내용을 확인합니다.", "영수 또는 청구를 선택합니다.", "NEXT를 누릅니다."],
    ["선입은 영수", "여신은 청구", "거래처 확인", "금액 확인"],
    ["선입인데 청구로 선택함", "여신인데 영수로 선택함", "내용 확인 없이 NEXT를 누름"],
    ["영수와 청구 선택은 수금 흐름과 연결됩니다. 선입/여신을 먼저 확인하세요."],
    ["tax-issue-timing", "tax-supply-vat", "ops-invoice-match"]
  ),
  ikiSeed(
    "iki-advance-shipment",
    "Tracking 선출고 승인",
    "여신 만료, 한도 초과, 선입 미입금 상황에서 선출고 승인을 요청하는 기능입니다.",
    ["출고가 막혔지만 업무상 선출고가 필요한 경우 사용합니다.", "승인 후 출고가 가능한 예외 상황에서 사용합니다."],
    ["여신 만료", "여신 한도 초과", "선입 미입금", "100만원 이상 AR 발생"],
    ["여신 연장 또는 한도 증액 필요 여부를 확인합니다.", "선출고 요청을 선택합니다.", "입금예정일을 입력합니다.", "사유를 입력합니다.", "승인 URL을 생성합니다.", "부장 승인을 받습니다.", "100만원 이상 AR 발생 시 재무 승인을 확인합니다."],
    ["승인 완료 여부 확인", "입금예정일 확인", "사유 구체성 확인", "재무 승인 필요 여부 확인"],
    ["승인 요청만 올리고 끝냄", "입금예정일을 대략 입력함", "재무 승인 필요 건을 놓침"],
    ["선출고는 예외 처리입니다. 승인 완료와 입금예정일을 반드시 끝까지 확인하세요."],
    ["tax-ar", "ops-collections", "ops-gatekeeper"]
  ),
  ikiSeed(
    "iki-collect-money",
    "Tracking 수금매칭",
    "입금 내역과 거래를 연결해 수금 상태를 닫는 기능입니다.",
    ["입금은 되었지만 거래에 연결되지 않은 경우 사용합니다.", "AR이 남아 있거나 수금매칭이 필요한 경우 사용합니다."],
    ["입금자명 불일치", "부분입금", "일괄입금", "수금매칭 보류"],
    ["COLLECT MONEY를 선택합니다.", "날짜를 선택합니다.", "업체를 검색합니다.", "매칭 대상을 선택합니다.", "Sales Matching을 선택합니다.", "금액을 확인합니다.", "매칭 완료 처리합니다."],
    ["입금금액 일치", "거래처 일치", "매칭 대상 확인", "차액 확인"],
    ["입금일을 잘못 선택함", "비슷한 업체를 선택함", "금액 확인 없이 매칭함"],
    ["수금매칭이 끝나야 입금 흐름이 거래와 연결됩니다. 돈을 받았다고 자동 종료되는 것은 아닙니다."],
    ["ops-collection-match", "ops-collections", "tax-partial-payment"]
  ),
  ikiSeed(
    "iki-rma",
    "Tracking RMA",
    "반품, 교환, 불량 등으로 기존 거래를 되돌려 확인해야 할 때 사용하는 흐름입니다.",
    ["고객 반품이나 불량 이슈가 발생했을 때 사용합니다.", "입고/출고/계산서 흐름에 영향을 주는 예외 거래를 확인할 때 사용합니다."],
    ["불량 반품", "오배송", "교환 요청", "공급처 확인 필요"],
    ["RMA 대상 거래를 찾습니다.", "반품 또는 교환 사유를 확인합니다.", "기존 출고와 계산서 상태를 확인합니다.", "필요한 증빙과 메모를 남깁니다.", "후속 계산서 또는 수금 영향 여부를 확인합니다."],
    ["원 거래 확인", "반품 사유 확인", "계산서 수정 필요 여부 확인", "수금 영향 확인"],
    ["원 거래를 확인하지 않음", "반품 사유를 짧게만 남김", "계산서 수정 필요 여부를 놓침"],
    ["RMA는 물류 이슈처럼 보여도 계산서와 수금에 영향을 줄 수 있습니다."],
    ["tax-revise", "ops-month-end", "tax-ar"]
  ),
  ikiSeed(
    "iki-coc",
    "Tracking COC 작성",
    "고객에게 COC 문서를 다운로드, 편집, 발송하는 업무 흐름입니다.",
    ["고객이 COC 증빙을 요청한 경우 사용합니다.", "공급처별 포함 페이지 기준을 확인해야 할 때 사용합니다."],
    ["Mouser COC", "Digikey COC", "PDF 발송", "상품명 기준 파일 저장"],
    ["COC를 다운로드합니다.", "PDF를 편집합니다.", "공급처별 포함 페이지를 확인합니다.", "파일명을 상품명 기준으로 저장합니다.", "PDF만 메일로 발송합니다."],
    ["Mouser는 마지막 페이지 포함", "Digikey는 첫 페이지 + 마지막 페이지 포함", "파일명은 상품명 기준", "PDF만 발송"],
    ["공급처별 포함 페이지를 반대로 적용함", "파일명을 임의로 저장함", "PDF 외 파일을 함께 보냄"],
    ["COC는 고객이 그대로 전달받는 문서입니다. 공급처별 규칙과 파일명을 꼭 맞추세요."],
    ["iki-order-coc-request", "ops-request", "mistake-8"]
  ),
  ikiSeed(
    "iki-order-split",
    "Tracking Order 분할",
    "일부 선적, 일부 출고, 일부 발주가 필요한 경우 Order를 나누는 기능입니다.",
    ["일부만 먼저 처리해야 하는 예외 상황에서 사용합니다.", "수금매칭 전, 입고 전 상황에서만 검토합니다."],
    ["일부 선적", "일부 출고", "일부 발주"],
    ["분할 필요 사유를 확인합니다.", "수금매칭 전인지 확인합니다.", "입고 전인지 확인합니다.", "분할 대상을 확인합니다.", "분할 후 금액과 수량을 다시 확인합니다."],
    ["수금매칭 전 여부", "입고 전 여부", "분할 수량 확인", "금액 변동 확인"],
    ["입고 후 분할하려고 함", "수금매칭 후 분할하려고 함", "권장되지 않는 기능임을 놓침"],
    ["Order 분할은 권장 기능이 아닙니다. 꼭 필요한 경우에만 기준을 확인하고 진행하세요."],
    ["iki-order", "tax-supply-vat", "ops-month-end"]
  ),
  ikiSeed(
    "iki-month-end-write",
    "Tracking 월마감 작성",
    "월마감 화면에서 미발행 사유와 Sales 의견을 작성하는 기능입니다.",
    ["VIPS 확인 전 Sales 의견이 필요한 경우 사용합니다.", "월마감 대상 거래에 미발행 또는 미완료 사유를 남길 때 사용합니다."],
    ["계산서 미발행 사유 작성", "Sales 의견 작성", "월마감 저장"],
    ["월마감 화면을 엽니다.", "미발행 사유를 선택합니다.", "Sales 의견을 작성합니다.", "저장합니다.", "VIPS 확인 전 작성 완료 여부를 확인합니다."],
    ["미발행 사유 선택", "Sales 의견 구체성", "저장 여부", "VIPS 확인 전 완료 여부"],
    ["의견을 비워둠", "저장하지 않고 화면을 닫음", "VIPS 확인 후에 작성함"],
    ["월마감 의견은 VIPS가 거래 상태를 판단하는 근거입니다. 짧아도 구체적으로 남기세요."],
    ["ops-month-end", "ops-gatekeeper", "tax-month-end-importance"]
  )
];

const orderManualSeeds: ArticleSeed[] = [
  ikiSeed("iki-order-quotation-to-order", "Order Quotation to Order", "견적을 실제 주문으로 전환하는 기능입니다.", ["견적 이후 고객 주문이 확정된 경우 사용합니다."], ["견적 승인 후 주문 생성", "Booking 전환"], ["견적을 확인합니다.", "고객 주문 의사를 확인합니다.", "Order로 전환합니다.", "품목, 수량, 금액을 다시 확인합니다."], ["견적번호 확인", "수량 확인", "금액 확인"], ["견적 금액과 주문 금액을 혼동함", "품목 일부를 누락함"], ["Quotation은 제안이고 Order는 실제 주문입니다. 두 상태를 혼동하지 마세요."], ["iki-order", "glossary-booking", "tax-supply-vat"]),
  ikiSeed("iki-order-attachment", "Order 발주요청 파일 첨부", "발주 요청에 필요한 파일을 Order에 첨부하는 기능입니다.", ["발주 근거 파일이나 고객 요청 파일을 남겨야 할 때 사용합니다."], ["발주요청서 첨부", "고객 PO 첨부", "승인 근거 보관"], ["Order를 엽니다.", "첨부 영역을 확인합니다.", "발주요청 파일을 첨부합니다.", "파일명이 식별 가능한지 확인합니다."], ["파일명 확인", "첨부 누락 확인", "최신본 여부 확인"], ["이전 파일을 첨부함", "파일명을 알아보기 어렵게 저장함"], ["첨부파일은 나중에 거래를 설명하는 근거입니다. 누가 봐도 알 수 있게 남기세요."], ["iki-order", "ops-request", "mistake-8"]),
  ikiSeed("iki-order-coc-request", "Order COC 요청", "Order 단계에서 COC 필요 여부를 요청하거나 남기는 기능입니다.", ["고객이 COC를 요청한 경우 사용합니다."], ["공급처 COC 요청", "고객 납품 증빙 준비"], ["고객 COC 요청 여부를 확인합니다.", "Order에 COC 요청을 남깁니다.", "공급처별 발급 가능 여부를 확인합니다.", "납품 전 발송 준비를 합니다."], ["고객 요청 여부", "공급처 기준", "발송 파일 형식"], ["요청 여부를 메모하지 않음", "공급처별 규칙을 확인하지 않음"], ["COC는 출고 후 찾으면 늦을 수 있습니다. Order 단계에서 먼저 표시하세요."], ["iki-coc", "iki-order", "ops-request"]),
  ikiSeed("iki-order-hold", "Order Hold", "주문 진행을 잠시 멈춰야 할 때 사용하는 기능입니다.", ["입금, 승인, 고객 확인 전 주문 진행을 막아야 할 때 사용합니다."], ["입금 대기", "고객 최종 확인 대기", "내부 승인 대기"], ["Hold 사유를 확인합니다.", "Order Hold를 설정합니다.", "메모를 남깁니다.", "해제 조건을 확인합니다."], ["Hold 사유", "해제 조건", "담당자 공유"], ["Hold 사유를 남기지 않음", "해제 후 공유하지 않음"], ["Hold는 막는 기능이 아니라 사고를 막는 표시입니다. 사유와 해제 조건이 핵심입니다."], ["iki-order-memo", "ops-request-status", "ops-gatekeeper"]),
  ikiSeed("iki-order-delete", "Order 삭제", "잘못 생성된 Order를 삭제하거나 정리하는 기능입니다.", ["중복 또는 오류 Order가 생성된 경우 사용합니다."], ["중복 주문", "잘못된 거래처", "고객 취소"], ["삭제 사유를 확인합니다.", "관련 Tracking이나 Billing 연결 여부를 확인합니다.", "삭제 가능 상태인지 확인합니다.", "삭제 후 메모를 남깁니다."], ["삭제 사유", "연결 거래 여부", "계산서/입금 영향"], ["연결 거래를 확인하지 않고 삭제함", "삭제 사유를 남기지 않음"], ["Order 삭제는 거래 흐름을 끊을 수 있습니다. 연결된 계산서와 수금 상태를 먼저 확인하세요."], ["iki-order", "ops-month-end", "tax-revenue-recognition"]),
  ikiSeed("iki-payment-request", "Order 입금요청서 발송", "고객에게 입금 요청서를 발송하는 기능입니다.", ["선입금이 필요하거나 입금 안내가 필요한 경우 사용합니다."], ["선입 거래", "입금 예정 안내", "고객 요청서 재발송"], ["Order 금액을 확인합니다.", "입금계좌와 금액을 확인합니다.", "입금요청서를 발송합니다.", "발송 후 고객 확인 여부를 메모합니다."], ["금액 확인", "계좌 확인", "고객 이메일 확인"], ["금액 오류", "이메일 오류", "발송 후 확인 누락"], ["입금요청서는 수금의 시작점입니다. 발송 후 실제 입금까지 이어서 확인하세요."], ["iki-payment", "ops-collections", "faq-1"]),
  ikiSeed("iki-delivery-statement", "Order 거래명세서 다운로드", "Order 기준 거래명세서를 다운로드하는 기능입니다.", ["고객에게 거래 내역 증빙을 전달해야 할 때 사용합니다."], ["거래명세서 재발송", "계산서 발행 전 내역 확인"], ["Order를 선택합니다.", "거래명세서 다운로드를 선택합니다.", "거래처와 품목을 확인합니다.", "파일을 저장하거나 전달합니다."], ["거래처 확인", "품목 확인", "금액 확인"], ["다른 Order 명세서를 보냄", "품목 누락을 확인하지 않음"], ["거래명세서는 계산서와 다릅니다. 고객이 어떤 문서를 요청했는지 먼저 확인하세요."], ["tax-definition", "iki-tracking-tax-issue", "ops-request"]),
  ikiSeed("iki-order-memo", "Order Memo", "Order에 진행 상황이나 확인 내용을 남기는 기능입니다.", ["다음 담당자가 거래 맥락을 이해해야 할 때 사용합니다."], ["고객 특이사항", "승인 상태", "입금 예정", "출고 보류 사유"], ["메모가 필요한 상황을 정리합니다.", "짧고 구체적으로 작성합니다.", "날짜와 확인 내용을 남깁니다.", "후속 처리자를 생각해 작성합니다."], ["날짜", "사유", "다음 행동", "담당자 공유"], ["감정적인 표현을 씀", "다음 행동을 남기지 않음"], ["좋은 메모는 미래의 나를 살립니다. 무엇을 확인했고 다음에 무엇을 해야 하는지 남기세요."], ["ops-request-status", "iki-order-hold", "ops-request"]),
  ikiSeed("iki-invoice-date", "Order 계산서 발행일 설정", "계산서 발행 예정일 또는 발행 기준일을 설정하는 기능입니다.", ["고객 요청 발행일이 있거나 월마감 기준 발행일을 맞춰야 할 때 사용합니다."], ["월말 발행", "고객 지정일 발행", "납품 후 발행"], ["고객 요청일을 확인합니다.", "발행 가능일을 확인합니다.", "계산서 발행일을 설정합니다.", "월마감 영향 여부를 확인합니다."], ["발행일", "발행월", "고객 요청", "월마감 영향"], ["발행월을 잘못 설정함", "전월 수정 가능성을 놓침"], ["발행일은 날짜 하나가 아니라 매출월과 월마감에 영향을 줍니다."], ["tax-issue-timing", "tax-revise", "ops-month-end"]),
  ikiSeed("iki-auto-issue-exclude", "Order 자동발행 제외", "자동 계산서 발행 대상에서 제외해야 할 때 사용하는 기능입니다.", ["예외 발행, 고객 확인 대기, 금액 미확정 상황에서 사용합니다."], ["고객 확인 전", "금액 변경 예정", "수정 가능성 있음"], ["자동발행 제외 사유를 확인합니다.", "Order에서 제외 설정을 합니다.", "메모를 남깁니다.", "수동 발행 필요 시기를 확인합니다."], ["제외 사유", "수동 발행 예정일", "담당자 공유"], ["제외 후 수동 발행을 놓침", "사유를 남기지 않음"], ["자동발행 제외는 끝이 아니라 수동 확인 시작입니다. 다시 확인할 날짜를 남기세요."], ["tax-issue-timing", "ops-month-end", "ops-request"]),
  ikiSeed("iki-shop-share", "Order Shop Share", "Shop 주문 또는 공유 주문 흐름을 확인하는 기능입니다.", ["온라인 주문 흐름과 Sales 관리 흐름을 연결해야 할 때 사용합니다."], ["Shop 주문 확인", "고객 주문 공유", "온라인 주문 후속 처리"], ["Shop 주문 정보를 확인합니다.", "Order와 연결된 정보를 봅니다.", "품목, 수량, 금액을 확인합니다.", "필요한 후속 처리를 메모합니다."], ["Shop 주문번호", "거래처", "품목", "금액"], ["Shop 주문과 일반 Order를 혼동함", "후속 메모를 남기지 않음"], ["Shop Share는 온라인 주문을 Sales 흐름 안으로 가져오는 연결점입니다."], ["iki-order", "iki-tracking-search", "ops-request"]),
  ikiSeed("iki-credit-request", "Order 여신 신청", "여신 거래가 필요한 고객에 대해 여신 신청을 진행하는 기능입니다.", ["고객이 후불 거래를 요청하거나 기존 여신 한도가 필요한 경우 사용합니다."], ["신규 여신", "한도 증액", "여신 연장"], ["고객 정보를 확인합니다.", "여신 필요 사유를 정리합니다.", "여신 신청을 진행합니다.", "승인 완료 여부를 확인합니다."], ["고객 정보", "한도", "기간", "승인 완료 여부"], ["승인 전 거래 진행", "한도 초과 여부 미확인"], ["여신은 수금 리스크와 연결됩니다. 승인 여부와 한도를 반드시 확인하세요."], ["iki-advance-shipment", "tax-ar", "ops-collections"])
];

const articleSeeds: ArticleSeed[] = [
  ...trackingManualSeeds,
  ...orderManualSeeds,
  {
    id: "iki-tracking",
    category: "iki",
    title: "Tracking 조회",
    description: "거래가 지금 어느 단계에 있는지 Tracking 기준으로 확인합니다.",
    tags: ["IKI", "Tracking", "거래 조회"],
    use: ["고객이 진행 상태를 물어볼 때 사용합니다.", "월마감에 거래가 남아 있는데 원인을 찾을 때 사용합니다."],
    frequent: ["출고는 되었는데 계산서가 없는 경우", "계산서는 있는데 입금이 연결되지 않은 경우", "요청 전 거래 링크가 필요한 경우"],
    process: ["Tracking 번호를 확인합니다.", "거래처명과 담당 Sales를 확인합니다.", "입고, 출고, 계산서, 입금 상태를 순서대로 봅니다.", "OPS에서 필요한 요청으로 이어갑니다."],
    checks: ["□ Tracking 번호가 맞는가", "□ 거래처명이 같은가", "□ 출고와 계산서 상태가 맞는가", "□ 입금 또는 수금매칭이 남아 있는가"],
    mistakes: ["× 주문번호만 보고 Tracking을 확인하지 않음", "× 비슷한 거래처명을 잘못 선택함", "× 출고 완료를 거래 완료로 착각함"],
    tip: ["Tracking은 거래의 주소입니다. VIPS 요청 전에는 가능한 한 Tracking URL을 함께 남겨주세요."],
    relatedArticleIds: ["ops-month-end", "ops-invoice-match", "ops-collection-match"]
  },
  {
    id: "iki-order",
    category: "iki",
    title: "Order 조회",
    description: "발주와 주문 기준 정보를 확인해 거래 시작점을 찾습니다.",
    tags: ["IKI", "Order", "주문"],
    use: ["고객 주문 정보와 내부 거래 흐름을 맞출 때 사용합니다.", "주문 기준 금액과 품목을 확인할 때 사용합니다."],
    frequent: ["품목 또는 수량 문의", "거래처명 확인", "출고 전 주문 상태 확인"],
    process: ["Order 번호를 검색합니다.", "거래처와 품목을 확인합니다.", "수량, 단가, 금액을 확인합니다.", "Tracking과 연결된 거래인지 확인합니다."],
    checks: ["□ 주문번호가 맞는가", "□ 품목과 수량이 맞는가", "□ 단가와 금액이 요청 내용과 같은가", "□ Tracking 연결이 있는가"],
    mistakes: ["× 견적 금액과 주문 금액을 혼동함", "× 같은 거래처의 다른 주문을 선택함", "× 품목이 여러 개인데 한 줄만 확인함"],
    tip: ["세금계산서 요청 전에는 Order와 Tracking의 금액이 같은 흐름인지 먼저 확인하세요."],
    relatedArticleIds: ["tax-supply-vat", "tax-issue-timing", "ops-request"]
  },
  {
    id: "iki-accounting",
    category: "iki",
    title: "Accounting 조회",
    description: "계산서, 입금, AR 흐름을 회계 기준으로 확인합니다.",
    tags: ["IKI", "Accounting", "계산서", "입금"],
    use: ["계산서 발행 여부와 입금 연결 상태를 확인할 때 사용합니다.", "AR 또는 Deduct가 남아 있는 이유를 찾을 때 사용합니다."],
    frequent: ["입금확인이 안 되는 경우", "계산서매칭 오류", "월마감에 AR이 남은 경우"],
    process: ["거래처명을 확인합니다.", "계산서 발행월과 금액을 확인합니다.", "입금일과 입금자명을 확인합니다.", "수금매칭 또는 차액 여부를 확인합니다."],
    checks: ["□ 계산서 금액과 입금 금액이 맞는가", "□ 입금자명이 거래처명과 다른가", "□ 부분입금이 아닌가", "□ Deduct가 남아 있는가"],
    mistakes: ["× 입금액만 보고 완료로 판단함", "× 입금자명 불일치를 놓침", "× Deduct를 확인하지 않음"],
    tip: ["Accounting에서 금액이 맞지 않으면 OPS 수금관리에서 먼저 본인 수금건을 확인하세요."],
    relatedArticleIds: ["ops-collections", "tax-ar", "tax-deduct"]
  },
  {
    id: "iki-shipment",
    category: "iki",
    title: "출고 조회",
    description: "출고 완료 여부와 출고 지연 상태를 확인합니다.",
    tags: ["IKI", "출고", "배송"],
    use: ["출고 완료 후 계산서 발행 여부를 확인할 때 사용합니다.", "월마감에서 출고 확인 필요 건이 나올 때 사용합니다."],
    frequent: ["입고는 되었지만 출고가 안 된 경우", "출고 완료 후 계산서가 없는 경우", "고객이 배송 상태를 문의한 경우"],
    process: ["Tracking 또는 Order를 찾습니다.", "출고일과 출고 상태를 확인합니다.", "출고 완료 후 계산서 발행 여부를 확인합니다.", "필요하면 월마감 체크에서 이슈를 닫습니다."],
    checks: ["□ 출고 완료일이 있는가", "□ 계산서 발행이 뒤따랐는가", "□ 고객 요청 납기와 차이가 있는가"],
    mistakes: ["× 입고 완료를 출고 완료로 착각함", "× 출고 후 계산서 발행을 놓침", "× 출고 지연 사유를 남기지 않음"],
    tip: ["출고는 거래 종료의 중간 단계입니다. 출고 후 계산서와 수금까지 이어져야 끝납니다."],
    relatedArticleIds: ["ops-month-end", "tax-issue-timing", "mistake-1"]
  },
  {
    id: "iki-payment",
    category: "iki",
    title: "입금 조회",
    description: "입금자명, 입금일자, 입금금액을 확인합니다.",
    tags: ["IKI", "입금", "수금"],
    use: ["입금확인 요청 전 실제 입금 정보를 확인할 때 사용합니다.", "입금자명이 거래처명과 다를 때 근거를 찾습니다."],
    frequent: ["입금확인이 안 됨", "부분입금 발생", "타업체명 입금"],
    process: ["거래처명과 입금자명을 확인합니다.", "입금일자와 입금금액을 확인합니다.", "예정금액과 차액을 비교합니다.", "OPS 수금관리에서 상태를 확인합니다."],
    checks: ["□ 입금자명이 같은가", "□ 입금금액이 예정금액과 같은가", "□ 입금일자가 요청 내용과 맞는가", "□ 부분입금 여부가 있는가"],
    mistakes: ["× 입금자명 불일치를 놓침", "× 일부 입금만 보고 완료 처리함", "× 계좌를 잘못 선택함"],
    tip: ["입금확인은 금액만 보는 일이 아닙니다. 입금자명, 일자, 거래처까지 같이 봐야 합니다."],
    relatedArticleIds: ["ops-collections", "faq-1", "tax-partial-payment"]
  },
  {
    id: "iki-virtual-tax",
    category: "iki",
    title: "가상계산서 처리",
    description: "가상계산서가 실제 계산서 흐름으로 이어지는지 확인합니다.",
    tags: ["IKI", "가상계산서", "계산서"],
    use: ["실제 계산서 발행 전 임시 계산서 흐름을 확인할 때 사용합니다.", "월마감에서 계산서 상태가 맞지 않을 때 확인합니다."],
    frequent: ["가상계산서만 있고 실제 발행이 안 된 경우", "발행월이 맞지 않는 경우", "고객 확인 후 실제 계산서 전환이 필요한 경우"],
    process: ["가상계산서 번호를 확인합니다.", "거래처, 금액, 발행 예정월을 확인합니다.", "실제 세금계산서 발행 여부를 확인합니다.", "필요하면 VIPS팀에 발행 기준을 문의합니다."],
    checks: ["□ 가상계산서와 실제 계산서 금액이 같은가", "□ 발행월이 맞는가", "□ 고객 확인이 끝났는가"],
    mistakes: ["× 가상계산서를 실제 발행 완료로 착각함", "× 발행월을 확인하지 않음", "× 고객 확인 없이 요청함"],
    tip: ["가상계산서는 실제 회사 프로세스 기준으로 계속 보완될 예정입니다. 현재는 계산서 상태 확인용으로 사용하세요."],
    relatedArticleIds: ["tax-virtual-invoice", "tax-issue-timing", "ops-request"]
  },
  {
    id: "ops-home",
    category: "ops",
    title: "Home 화면 활용하기",
    description: "오늘 확인해야 할 월마감·수금 이슈를 가장 먼저 읽는 방법입니다.",
    tags: ["Home", "오늘 할 일", "월마감", "수금"],
    level: "필수",
    use: ["포털에 접속하자마자 오늘 처리해야 할 거래를 확인할 때 사용합니다.", "요청을 올리기 전 월마감과 수금 상태를 먼저 점검합니다."],
    frequent: ["출근 직후", "VIPS 요청 전", "월말 마감 기간"],
    process: ["상단 확인 필요 거래 수를 봅니다.", "월마감 체크와 수금 체크를 각각 확인합니다.", "남은 거래가 있으면 먼저 점검합니다.", "필요한 VIPS 요청을 진행합니다."],
    checks: ["□ 확인 필요 거래가 남아 있는가", "□ 수금 확인 필요 건이 있는가", "□ 요청 전에 Gatekeeper가 걸릴 상태인가"],
    mistakes: ["× 요청 바로가기만 먼저 누름", "× 수금 체크를 보지 않음", "× 확인 필요 금액을 놓침"],
    tip: ["Home은 점수판이 아니라 오늘 놓치면 안 되는 거래를 알려주는 첫 화면입니다."],
    relatedArticleIds: ["ops-month-end", "ops-collections", "ops-gatekeeper"]
  },
  {
    id: "ops-month-end",
    category: "ops",
    title: "월마감 체크 활용법",
    description: "ERP 월마감 데이터를 영업 행동 목록으로 바꿔 확인하는 방법입니다.",
    tags: ["월마감", "거래 종료", "ERP"],
    level: "필수",
    use: ["내 거래 중 아직 종료되지 않은 건을 확인할 때 사용합니다.", "출고, 계산서, 수금 흐름이 끊긴 거래를 찾습니다."],
    frequent: ["월말", "VIPS 요청 전", "계산서 발행 필요 건 확인 시"],
    process: ["내 월마감 이슈를 봅니다.", "계산서 발행 필요, 출고 확인 필요, Deduct 확인 필요를 구분합니다.", "거래처와 금액을 확인합니다.", "필요한 요청 또는 확인 완료 처리를 합니다."],
    checks: ["□ 출고O/계산서X가 있는가", "□ 입고O/출고X가 있는가", "□ Deduct 금액이 남아 있는가", "□ 지연 AR이 있는가"],
    mistakes: ["× 월마감을 단순 체크로 생각함", "× 금액 큰 건을 뒤로 미룸", "× 완료 사유를 남기지 않음"],
    tip: ["월마감은 '월말에 하는 일'이 아니라 거래가 끝났는지 확인하는 안전장치입니다."],
    relatedArticleIds: ["tax-issue-timing", "tax-deduct", "mistake-1"]
  },
  {
    id: "ops-collections",
    category: "ops",
    title: "수금관리 활용법",
    description: "미수, 부분수금, 입금자명 매칭 이슈를 우선순위대로 처리합니다.",
    tags: ["수금관리", "미수", "부분수금"],
    level: "필수",
    use: ["내 수금 대상이 완료, 부분수금, 미수 중 어디에 있는지 볼 때 사용합니다.", "오늘 확인해야 할 수금 TOP5를 처리합니다."],
    frequent: ["입금일 이후", "부분입금 발생 시", "월마감 전 AR 확인 시"],
    process: ["오늘 확인 필요 건수를 봅니다.", "TOP5에서 고액 또는 장기미수를 먼저 봅니다.", "예정금액, 입금금액, 차액을 확인합니다.", "확인 완료 또는 VIPS 확인 요청을 남깁니다."],
    checks: ["□ 완료와 부분수금을 구분했는가", "□ 입금자명이 맞는가", "□ 차액이 남아 있는가", "□ 장기미수 여부가 있는가"],
    mistakes: ["× 부분수금을 완료로 착각함", "× 입금자명 확인을 건너뜀", "× 확인했지만 메모를 남기지 않음"],
    tip: ["수금관리의 핵심은 '돈을 받았는가'보다 '어떤 거래가 아직 남았는가'입니다."],
    relatedArticleIds: ["tax-ar", "tax-partial-payment", "ops-collection-match"]
  },
  {
    id: "ops-request",
    category: "ops",
    title: "VIPS 요청하기",
    description: "금액, 링크, 첨부, 사유를 정확히 준비해 요청 반려를 줄입니다.",
    tags: ["VIPS", "요청", "반려"],
    level: "필수",
    use: ["세금계산서, 입금확인, 보증보험, 매칭 요청이 필요할 때 사용합니다.", "월마감/수금 확인 후 다음 처리가 필요할 때 사용합니다."],
    frequent: ["계산서 발행 필요", "입금확인 필요", "보증보험 서류 요청", "매칭 또는 해제 필요"],
    process: ["먼저 Home에서 확인 필요 거래를 봅니다.", "월마감/수금 상태를 확인합니다.", "요청 메뉴를 선택합니다.", "필수 입력값과 첨부를 넣고 제출합니다."],
    checks: ["□ 거래처명이 정확한가", "□ 금액이 맞는가", "□ 링크가 있는가", "□ 첨부파일이 필요한 요청인가"],
    mistakes: ["× 사유 없이 요청함", "× 기존 계산서 링크를 누락함", "× 카드전표 또는 계약서를 첨부하지 않음"],
    tip: ["요청은 빠르게 올리는 것보다 반려 없이 한 번에 처리되게 올리는 것이 더 빠릅니다."],
    relatedArticleIds: ["tax-revise", "faq-3", "ops-request-status"]
  },
  {
    id: "ops-request-status",
    category: "ops",
    title: "나의 요청현황 확인하기",
    description: "접수, 처리중, 완료, 반려 상태를 확인하고 후속 조치합니다.",
    tags: ["요청현황", "처리중", "반려"],
    use: ["내가 올린 요청의 처리 상태를 확인할 때 사용합니다.", "반려된 요청을 다시 보완할 때 사용합니다."],
    frequent: ["요청 후 처리 상태 확인", "반려 사유 확인", "월마감 전 요청 누락 확인"],
    process: ["접수, 처리중, 완료, 반려 숫자를 봅니다.", "반려 건이 있으면 사유를 확인합니다.", "필요한 정보를 보완해 다시 요청합니다."],
    checks: ["□ 반려 사유를 읽었는가", "□ 보완할 첨부가 있는가", "□ 같은 요청을 중복으로 올리지 않았는가"],
    mistakes: ["× 처리중 건을 다시 요청함", "× 반려 사유를 확인하지 않음", "× 완료 여부만 보고 거래 종료를 판단함"],
    tip: ["요청 완료와 거래 종료는 다를 수 있습니다. 수금과 매칭까지 함께 확인하세요."],
    relatedArticleIds: ["ops-request", "ops-month-end", "ops-collections"]
  },
  {
    id: "ops-gatekeeper",
    category: "ops",
    title: "Gatekeeper란 무엇인가?",
    description: "미종료 거래가 남아 있을 때 요청 진입이 제한되는 이유입니다.",
    tags: ["Gatekeeper", "차단", "거래 종료"],
    level: "필수",
    use: ["VIPS 요청 진입이 막혔을 때 원인을 이해하기 위해 사용합니다.", "내 거래 중 미종료 건을 먼저 정리해야 할 때 사용합니다."],
    frequent: ["월마감 미완료", "수금 확인 필요", "계산서 발행 누락"],
    process: ["차단 메시지의 사유를 확인합니다.", "월마감 체크 또는 수금관리로 이동합니다.", "미종료 거래를 확인합니다.", "처리 또는 확인 완료 후 요청을 진행합니다."],
    checks: ["□ 미종료 거래가 남아 있는가", "□ 수금 이슈가 있는가", "□ 계산서 발행 필요 건이 있는가"],
    mistakes: ["× 차단을 오류로 생각함", "× 요청만 우회하려고 함", "× 미종료 거래를 확인하지 않음"],
    tip: ["Gatekeeper는 막는 기능이 아니라, 요청 전에 거래를 끝까지 책임지게 하는 장치입니다."],
    relatedArticleIds: ["ops-month-end", "ops-collections", "tax-month-end-importance"]
  },
  {
    id: "ops-invoice-match",
    category: "ops",
    title: "계산서매칭 기능",
    description: "계산서와 Tracking 흐름을 연결하거나 해제하는 기준입니다.",
    tags: ["계산서매칭", "Tracking", "매칭"],
    use: ["계산서는 발행됐지만 거래 흐름과 연결되지 않았을 때 사용합니다.", "잘못 연결된 계산서를 해제해야 할 때 사용합니다."],
    frequent: ["계산서 링크와 Tracking URL 연결", "잘못된 거래처 연결 해제", "월마감 계산서 오류 정리"],
    process: ["계산서 링크를 확인합니다.", "Tracking URL을 확인합니다.", "연결 또는 해제를 선택합니다.", "요청 사유를 남깁니다."],
    checks: ["□ 계산서 금액이 맞는가", "□ Tracking 거래처가 같은가", "□ 연결/해제 방향이 맞는가"],
    mistakes: ["× 비슷한 Tracking에 연결함", "× 해제 요청인데 매칭으로 올림", "× 요청 사유를 비워둠"],
    tip: ["계산서매칭은 계산서와 거래 흐름을 묶는 작업입니다. 연결 대상을 꼭 다시 확인하세요."],
    relatedArticleIds: ["tax-definition", "tax-issue-timing", "mistake-9"]
  },
  {
    id: "ops-collection-match",
    category: "ops",
    title: "수금매칭 기능",
    description: "입금 흐름과 거래/계산서 흐름을 연결하는 기준입니다.",
    tags: ["수금매칭", "입금", "AR"],
    use: ["입금은 되었지만 거래에 연결되지 않았을 때 사용합니다.", "부분입금, 일괄입금, 타업체명 입금을 정리할 때 사용합니다."],
    frequent: ["입금자명 불일치", "부분입금", "AR 잔액 남음"],
    process: ["수금 링크를 확인합니다.", "Tracking과 세금계산서 링크를 확인합니다.", "매칭 또는 해제를 선택합니다.", "차액이나 특이사항을 메모합니다."],
    checks: ["□ 입금금액과 예정금액이 맞는가", "□ 입금자명이 다른 이유가 있는가", "□ 부분입금 잔액이 남는가"],
    mistakes: ["× 입금만 보고 매칭 완료로 생각함", "× 세금계산서 링크를 누락함", "× 차액 사유를 남기지 않음"],
    tip: ["수금매칭이 안 되면 돈을 받아도 AR이 남을 수 있습니다."],
    relatedArticleIds: ["ops-collections", "tax-partial-payment", "mistake-10"]
  }
];

const taxSeeds: ArticleSeed[] = [
  taxSeed("tax-definition", "세금계산서란 무엇인가요?", "매출과 부가세 신고의 기준이 되는 핵심 증빙입니다.", ["세금계산서", "증빙", "매출"], "거래가 실제 매출로 정리되었음을 증명할 때 사용합니다.", "출고 후 매출 확정이 필요할 때 가장 많이 봅니다.", ["거래처 확인", "공급가액 확인", "부가세 확인", "발행월 확인"], ["금액만 보고 거래처를 확인하지 않음", "발행월을 놓침"], "세금계산서는 단순 서류가 아니라 매출 흐름의 기준점입니다."),
  taxSeed("tax-issue-timing", "세금계산서는 언제 발행하나요?", "출고와 거래 조건이 확정된 뒤 발행 기준을 확인합니다.", ["세금계산서", "발행", "출고"], "출고가 완료되고 청구 금액이 확정되었을 때 사용합니다.", "출고O/계산서X 월마감 이슈에서 가장 많이 사용합니다.", ["출고일 확인", "품목/수량 확인", "공급가액 확인", "발행월 선택"], ["출고 전 발행 요청", "발행월 오류"], "출고가 끝났다면 계산서가 뒤따라야 월마감에서 빠집니다."),
  taxSeed("tax-revise", "수정세금계산서는 언제 사용하나요?", "기존 계산서 금액, 거래처, 품목, 사유가 바뀔 때 사용합니다.", ["수정세금계산서", "전월", "수정발행"], "이미 발행된 계산서를 바로잡을 때 사용합니다.", "전월 계산서 금액 변경, 거래처 변경, 품목 변경 때 가장 많이 사용합니다.", ["기존 계산서 확인", "수정 사유 선택", "수정 내용 입력", "거래처 확인"], ["기존 계산서를 새로 발행함", "수정 사유 누락", "전월 수정 영향 확인 누락"], "수정세금계산서는 새 계산서가 아니라 기존 계산서를 수정하는 개념입니다."),
  taxSeed("tax-reverse", "역발행이란 무엇인가요?", "거래처 시스템에서 세금계산서를 역으로 발행하는 흐름입니다.", ["역발행", "계산서"], "거래처가 지정한 사이트에서 계산서 처리가 필요할 때 사용합니다.", "공공기관, 대기업, 지정 포털 거래에서 자주 발생합니다.", ["역발행 사이트 확인", "최종금액 확인", "건수 확인", "발행 상태 확인"], ["사이트명 누락", "최종금액 오기재"], "역발행은 사이트와 금액이 핵심입니다. 요청에 둘 중 하나라도 빠지면 확인이 지연됩니다."),
  taxSeed("tax-vat", "부가세란 무엇인가요?", "공급가액에 붙는 10% 세금입니다.", ["부가세", "VAT"], "계산서 금액을 공급가액, 부가세, 합계액으로 나눌 때 사용합니다.", "세금계산서 발행 요청과 금액 검증 때 가장 많이 사용합니다.", ["공급가액 확인", "10% 계산", "합계액 확인"], ["부가세를 반올림함", "합계액만 입력함"], "333원의 부가세는 33원입니다. 원단위 계산을 임의로 바꾸지 마세요."),
  taxSeed("tax-supply-vat", "공급가액과 부가세 계산", "수량과 단가로 공급가액, 부가세, 합계액을 계산합니다.", ["공급가액", "부가세", "합계액"], "세금계산서 발행 요청 금액을 검증할 때 사용합니다.", "품목이 여러 개이거나 단가가 작은 거래에서 많이 사용합니다.", ["수량 x 단가", "공급가액 산출", "부가세 10% 계산", "합계액 확인"], ["수량을 빠뜨림", "단가 기준을 잘못 봄", "원단위 임의 조정"], "계산식은 단순하지만 금액 오류는 반려로 바로 이어집니다."),
  taxSeed("tax-no-rounding", "원단위 절사를 하면 안 되는 이유", "원단위 차이가 계산서와 입금 매칭 오류로 이어지는 이유입니다.", ["원단위", "절사", "VAT"], "부가세 계산이나 합계액 입력 시 원단위가 애매할 때 사용합니다.", "소액 단가, 다품목 계산서, 부분입금 확인 때 많이 발생합니다.", ["ERP 금액 확인", "공급가액 확인", "부가세 확인", "합계액 그대로 입력"], ["보기 좋게 금액을 맞춤", "1원 차이를 무시함"], "1원 차이도 계산서와 수금매칭에서는 오류가 됩니다."),
  taxSeed("tax-ar", "AR이란 무엇인가요?", "매출은 잡혔지만 아직 회수되지 않은 받을 돈입니다.", ["AR", "미수", "수금"], "수금관리와 월마감에서 미수 상태를 이해할 때 사용합니다.", "계산서O/수금X 상태에서 가장 많이 사용합니다.", ["계산서 발행 확인", "입금 여부 확인", "차액 확인", "수금매칭 확인"], ["계산서 발행을 수금 완료로 착각", "부분입금을 완료로 처리"], "AR이 남아 있으면 거래는 아직 끝난 것이 아닙니다."),
  taxSeed("tax-partial-payment", "부분입금은 왜 위험한가요?", "완납이 아니므로 잔액과 수금매칭을 반드시 확인해야 합니다.", ["부분입금", "수금매칭", "미수"], "입금액이 예정금액보다 적을 때 사용합니다.", "고객이 일부만 먼저 입금하거나 일괄 입금한 경우 자주 발생합니다.", ["예정금액 확인", "입금금액 확인", "차액 계산", "잔액 사유 확인"], ["부분입금을 완료로 착각", "차액 메모 누락"], "부분입금은 완료가 아닙니다. 차액이 0원이 될 때까지 확인해야 합니다."),
  taxSeed("tax-deduct", "Deduct란 무엇인가요?", "거래 금액에서 차감 또는 공제되는 금액입니다.", ["Deduct", "차감", "공제"], "월마감에서 Deduct 금액이 표시될 때 사용합니다.", "공제 사유, 할인, 차감 처리 확인 때 자주 사용합니다.", ["Deduct 금액 확인", "차감 사유 확인", "거래처와 합의 여부 확인", "월마감 반영 확인"], ["Deduct를 미수로 착각", "차감 사유를 남기지 않음"], "Deduct는 금액보다 사유가 중요합니다. 사유가 없으면 월마감에서 계속 남습니다."),
  taxSeed("tax-month-end-importance", "월마감이 왜 중요한가요?", "미완료 거래를 정리해 매출 누락과 장기 미수를 줄입니다.", ["월마감", "거래 종료"], "한 달 거래가 정상 종료됐는지 확인할 때 사용합니다.", "월말, 분기말, 결산 전 가장 많이 사용합니다.", ["입고 확인", "출고 확인", "계산서 확인", "수금 확인"], ["출고만 보고 종료로 판단", "미수 상태를 놓침"], "월마감은 체크가 아니라 거래를 끝까지 닫는 과정입니다."),
  taxSeed("tax-revenue-recognition", "매출 인식이란 무엇인가요?", "거래가 회사 매출로 잡히는 기준입니다.", ["매출 인식", "매출"], "거래가 매출로 반영되는 흐름을 이해할 때 사용합니다.", "계산서 발행, 출고 완료, 월마감 확인 시 많이 등장합니다.", ["출고 상태 확인", "계산서 발행 확인", "매출월 확인"], ["매출월을 고객 요청월로만 판단", "계산서 발행 상태를 확인하지 않음"], "Sales는 회계처리를 직접 하지 않지만 매출 흐름의 시작점을 가장 잘 압니다."),
  taxSeed("tax-virtual-invoice", "가상계산서란 무엇인가요?", "실제 계산서 발행 전 임시로 관리되는 계산서 흐름입니다.", ["가상계산서", "임시", "계산서"], "실제 발행 전 고객 확인이나 내부 확인이 필요할 때 사용합니다.", "발행월, 금액, 고객 확인이 애매할 때 많이 등장합니다.", ["가상계산서 금액 확인", "실제 발행 여부 확인", "발행월 확인", "고객 확인 여부 확인"], ["가상계산서를 발행 완료로 착각", "실제 계산서 전환 여부를 확인하지 않음"], "현재 설명은 임시 기준입니다. 회사 실제 프로세스 확인 후 계속 보완됩니다."),
  taxSeed("tax-vat-reporting", "부가세 신고란 무엇인가요?", "회사가 받은 부가세와 낸 부가세를 정리해 신고·납부하는 절차입니다.", ["부가세신고", "VAT", "신고", "세금계산서"], "세금계산서 발행월과 매출 흐름이 신고 기준에 영향을 줄 때 사용합니다.", "월말, 분기말, 전월 계산서 수정 요청 때 가장 많이 확인합니다.", ["발행월 확인", "공급가액 확인", "부가세 확인", "수정 필요 여부 확인"], ["합계액만 보고 신고월을 놓침", "전월 계산서를 쉽게 수정할 수 있다고 생각함", "매출월과 발행월을 구분하지 않음"], "Sales가 신고를 직접 하지는 않지만, 계산서 발행월을 잘못 잡으면 VIPS와 회계 확인이 길어집니다."),
  taxSeed("tax-vat-periods", "부가세 신고기간은 언제인가요?", "부가세는 1기와 2기 과세기간으로 나누어 신고 흐름을 관리합니다.", ["부가세", "신고기간", "1기", "2기", "예정신고", "확정신고"], "전월 또는 전분기 계산서를 수정해야 하는지 판단할 때 사용합니다.", "1월, 4월, 7월, 10월 전후 계산서 수정 문의가 많을 때 확인합니다.", ["1기: 1월~6월", "2기: 7월~12월", "법인 예정신고: 4월/10월 25일 기준", "확정신고: 7월/다음해 1월 25일 기준"], ["신고가 끝난 기간을 현재월처럼 처리함", "거래처 마감과 세무 신고 마감을 혼동함", "휴일이면 마감일이 달라질 수 있음을 놓침"], "날짜는 세무 기준이므로 실제 요청 전에는 국세청/회계팀 기준을 한 번 더 확인하세요."),
  taxSeed("tax-vat-correction-risk", "부가세 신고 후 수정이 어려운 이유", "신고가 끝난 기간의 계산서 수정은 우리 회사와 거래처 모두에게 영향을 줄 수 있습니다.", ["부가세", "수정세금계산서", "마감", "전월수정"], "거래처가 전월 계산서 수정을 요청하거나 금액 변경을 요청할 때 사용합니다.", "월마감 이후, 부가세 신고기한 이후 수정 요청에서 자주 확인합니다.", ["기존 계산서 링크 확인", "수정 사유 확인", "신고 완료 여부 확인", "거래처 마감 여부 확인"], ["거래처 요청만 보고 바로 수정 요청", "수정 사유를 남기지 않음", "신고 완료 여부를 확인하지 않음"], "신고 후 수정은 단순 재발행이 아닙니다. 수정 사유와 기준월을 먼저 정리해야 합니다."),
  taxSeed("tax-vat-quarter-check", "분기별 부가세 체크 포인트", "분기 말에는 계산서 발행, 수정, 매출월 확인이 특히 중요합니다.", ["분기마감", "부가세", "계산서", "마감"], "분기 말 거래가 몰리거나 계산서 수정 요청이 늘어날 때 사용합니다.", "3월, 6월, 9월, 12월 말과 신고월 직전에 많이 봅니다.", ["미발행 계산서 확인", "전월 수정 요청 확인", "거래처 마감일 확인", "수금매칭 상태 확인"], ["분기 말 출고만 확인하고 계산서 누락", "마감 후 거래처 수정 요청을 늦게 공유", "수금상태와 계산서상태를 따로 봄"], "분기 말에는 빠른 발행보다 정확한 발행월과 금액 확인이 더 중요합니다."),
  taxSeed("tax-invoice-month-lock", "계산서 마감월을 왜 확인해야 하나요?", "계산서 발행월은 매출, 부가세, 월마감 기준을 함께 움직입니다.", ["계산서마감", "발행월", "매출월", "월마감"], "고객이 발행월을 변경해 달라고 요청할 때 사용합니다.", "월말 출고, 익월 계산서 요청, 전월 수정 요청 때 가장 많이 확인합니다.", ["출고일 확인", "고객 요청 발행월 확인", "매출월 영향 확인", "VIPS팀 가능 여부 확인"], ["고객 요청월만 보고 발행월 선택", "월마감 이후 발행월 변경 가능하다고 생각함", "계산서 링크 없이 수정 요청"], "발행월은 보기 좋은 날짜가 아니라 회사 매출과 신고 기준입니다.")
];

const faqSeeds: ArticleSeed[] = [
  faqSeed("faq-1", "입금확인이 안 됩니다.", ["입금자명 불일치", "거래처 선택 오류", "입금일 차이"], ["입금자명", "금액", "거래처", "입금일"], ["ops-collections", "iki-payment", "ops-collection-match"]),
  faqSeed("faq-2", "수정세금계산서 요청이 반려됐어요.", ["기존 계산서 링크 누락", "수정 사유 불명확", "전월 수정 영향 미확인"], ["기존 계산서", "수정 사유", "발행월", "거래처"], ["tax-revise", "ops-request", "mistake-4"]),
  faqSeed("faq-3", "보증보험은 언제 요청하나요?", ["계약이행 보증 필요", "하자이행 보증 필요", "선금이행 보증 필요"], ["계약서", "계약금액", "보증기간", "보증종류"], ["ops-request", "mistake-7", "faq-10"]),
  faqSeed("faq-4", "계산서매칭은 언제 하나요?", ["계산서가 거래 흐름과 연결되지 않음", "잘못 연결된 계산서 해제 필요"], ["계산서 링크", "Tracking URL", "요청 사유"], ["ops-invoice-match", "tax-definition", "mistake-9"]),
  faqSeed("faq-5", "수금매칭은 언제 하나요?", ["입금은 되었지만 거래에 연결되지 않음", "부분입금 또는 일괄입금 발생"], ["수금 링크", "Tracking URL", "세금계산서 링크", "차액"], ["ops-collection-match", "tax-partial-payment", "mistake-10"]),
  faqSeed("faq-6", "월마감 체크에서 반려되는 이유는 무엇인가요?", ["출고와 계산서 상태 불일치", "수금 미확인", "Deduct 사유 누락"], ["출고", "계산서", "수금", "Deduct"], ["ops-month-end", "tax-deduct", "ops-gatekeeper"]),
  faqSeed("faq-7", "거래가 완료됐는데 왜 월마감에 남아있나요?", ["계산서 미발행", "수금매칭 미완료", "입금자명 불일치"], ["Tracking", "계산서", "입금", "매칭"], ["ops-month-end", "ops-collections", "iki-tracking"]),
  faqSeed("faq-8", "Gatekeeper가 뜨는 이유는 무엇인가요?", ["미종료 거래 존재", "수금 확인 필요", "월마감 이슈 미처리"], ["월마감 체크", "수금관리", "확인 완료 여부"], ["ops-gatekeeper", "ops-month-end", "ops-collections"]),
  faqSeed("faq-9", "요청이 처리중인데 수정할 수 있나요?", ["처리중 요청은 임의 수정이 어렵습니다.", "추가 정보가 있으면 메모 또는 재요청 기준을 확인해야 합니다."], ["요청 상태", "반려 여부", "추가 사유"], ["ops-request-status", "ops-request", "faq-10"]),
  faqSeed("faq-10", "요청을 잘못 올렸어요.", ["중복 요청", "요청 유형 선택 오류", "금액 또는 링크 오류"], ["요청번호", "요청 유형", "잘못 입력한 항목"], ["ops-request-status", "ops-request", "mistake-4"]),
  faqSeed("faq-11", "입금자명이 거래처명과 다릅니다.", ["대표자명 입금", "계열사명 입금", "프로젝트명 입금"], ["입금자명", "거래처", "금액", "입금일"], ["iki-payment", "ops-collections", "ops-collection-match"]),
  faqSeed("faq-12", "부분입금이 발생했어요.", ["고객 일부 입금", "차액 예정", "Deduct 또는 할인 반영"], ["예정금액", "입금금액", "차액", "잔액 사유"], ["tax-partial-payment", "ops-collections", "tax-deduct"]),
  faqSeed("faq-13", "Deduct가 표시되면 어떻게 해야 하나요?", ["차감 사유 확인 필요", "공제 금액 반영 필요", "거래 종료 조건 미충족"], ["Deduct 금액", "차감 사유", "합의 여부"], ["tax-deduct", "ops-month-end", "mistake-6"]),
  faqSeed("faq-14", "세금계산서 발행 후 수정이 필요한 경우 어떻게 하나요?", ["금액 변경", "거래처 변경", "품목 변경", "사유 변경"], ["기존 계산서", "수정 사유", "전월 여부"], ["tax-revise", "ops-request", "mistake-4"]),
  faqSeed("faq-15", "카드결제 건도 월마감 체크에 남을 수 있나요?", ["카드전표 누락", "수금매칭 미완료", "거래 연결 오류"], ["카드전표", "결제금액", "거래처", "매칭 상태"], ["ops-collections", "ops-request", "mistake-5"])
];

const mistakeSeeds: ArticleSeed[] = [
  mistakeSeed("mistake-1", "계산서를 발행하지 않아 월마감이 지연된 사례", "출고는 완료했지만 계산서를 발행하지 않아 매출 확인이 지연되었습니다.", "출고 완료 후 계산서 발행 여부를 확인하지 않았습니다.", "월마감 대상에 남아 추가 확인이 발생했습니다.", ["ops-month-end", "tax-issue-timing", "ops-invoice-match"]),
  mistakeSeed("mistake-2", "부분입금을 완납으로 착각한 사례", "예정금액 중 일부만 입금됐지만 완료로 판단했습니다.", "차액을 확인하지 않고 입금 여부만 봤습니다.", "AR이 남고 수금매칭이 지연되었습니다.", ["tax-partial-payment", "ops-collections", "ops-collection-match"]),
  mistakeSeed("mistake-3", "거래처를 잘못 선택한 사례", "비슷한 이름의 거래처를 선택해 요청이 잘못 접수되었습니다.", "사업자명과 거래처 코드를 같이 확인하지 않았습니다.", "계산서 또는 입금 확인이 잘못 연결될 수 있었습니다.", ["iki-tracking", "ops-request", "faq-10"]),
  mistakeSeed("mistake-4", "수정세금계산서를 잘못 요청한 사례", "기존 계산서 링크 없이 수정 요청을 올렸습니다.", "수정세금계산서를 새 계산서 발행처럼 생각했습니다.", "반려 후 재요청이 필요했습니다.", ["tax-revise", "ops-request", "faq-2"]),
  mistakeSeed("mistake-5", "입금확인을 늦게 요청한 사례", "입금은 되었지만 확인 요청이 늦어 수금 상태가 계속 미수로 남았습니다.", "입금일 이후 수금관리 확인을 하지 않았습니다.", "월마감 전 추가 확인이 발생했습니다.", ["iki-payment", "ops-collections", "faq-1"]),
  mistakeSeed("mistake-6", "Deduct를 확인하지 않아 월마감이 지연된 사례", "차감 금액이 남아 있었지만 사유를 확인하지 않았습니다.", "Deduct를 미수와 구분하지 못했습니다.", "거래 종료 판단이 지연되었습니다.", ["tax-deduct", "faq-13", "ops-month-end"]),
  mistakeSeed("mistake-7", "보증보험 서류 누락 사례", "계약서 없이 보증보험 요청을 올렸습니다.", "필수 첨부 기준을 확인하지 않았습니다.", "요청이 반려되고 발급 일정이 밀렸습니다.", ["faq-3", "ops-request", "ops-request-status"]),
  mistakeSeed("mistake-8", "승인요청번호를 누락한 사례", "요청 근거 번호를 남기지 않아 담당자가 거래를 찾지 못했습니다.", "관련 링크와 번호를 요청 전에 정리하지 않았습니다.", "처리 시간이 길어졌습니다.", ["ops-request", "iki-tracking", "ops-request-status"]),
  mistakeSeed("mistake-9", "계산서매칭을 하지 않아 거래 종료가 지연된 사례", "계산서는 발행됐지만 Tracking과 연결되지 않았습니다.", "계산서 발행 후 매칭 상태를 확인하지 않았습니다.", "월마감에 계산서 이슈가 계속 남았습니다.", ["ops-invoice-match", "tax-definition", "ops-month-end"]),
  mistakeSeed("mistake-10", "수금매칭을 하지 않아 AR이 남은 사례", "입금은 되었지만 거래와 연결되지 않아 AR이 남았습니다.", "입금 확인과 수금매칭을 같은 일로 착각했습니다.", "수금 완료로 보이지 않아 추가 확인이 필요했습니다.", ["ops-collection-match", "tax-ar", "ops-collections"])
];

const glossarySeeds = [
  ["AR", "Accounts Receivable. 외상매출금입니다. 쉽게 말하면 제품은 출고했지만 아직 돈을 받지 못한 거래입니다."],
  ["AP", "Accounts Payable. 회사가 지급해야 할 비용 또는 매입 채무입니다."],
  ["GP", "Gross Profit. 매출에서 원가를 뺀 이익입니다."],
  ["Booking", "견적 이후 실제 주문까지 완료된 건입니다. 견적이 고객 주문으로 확정된 상태를 의미합니다."],
  ["Billing", "견적 발송 금액 또는 청구 기준 금액입니다. Booking은 주문 확정이고 Billing은 청구 기준 금액이라는 점을 구분해야 합니다."],
  ["BOM", "Bill of Materials. 프로젝트나 제품을 구성하는 부품 목록입니다. Tracking 검색에서 프로젝트명 대신 BOM으로 찾는 경우가 많습니다."],
  ["EMS", "Electronics Manufacturing Service. 전자제품 위탁 생산 또는 제조 서비스를 의미합니다."],
  ["PCB", "Printed Circuit Board. 전자부품이 실장되는 회로기판입니다."],
  ["SMT", "Surface Mount Technology. 부품을 PCB 표면에 실장하는 방식입니다."],
  ["RMA", "Return Merchandise Authorization. 반품, 교환, 불량 처리를 위해 거래를 되돌려 확인하는 절차입니다."],
  ["MOQ", "Minimum Order Quantity. 최소 주문 수량입니다."],
  ["MOA", "Minimum Order Amount. 최소 주문 금액입니다."],
  ["EXR", "Exchange Rate. 환율입니다. 외화 견적이나 매입 기준 금액을 볼 때 사용합니다."],
  ["COC", "Certificate of Conformance. 제품이 요구 조건에 맞게 공급되었음을 증명하는 문서입니다."],
  ["NCNR", "Non-Cancellable Non-Returnable. 주문 취소와 반품이 불가한 조건입니다."],
  ["Deduct", "거래 금액에서 차감 또는 공제되는 금액입니다."],
  ["미수금", "받아야 하지만 아직 입금되지 않은 금액입니다."],
  ["선수금", "거래 완료 전 먼저 받은 금액입니다."],
  ["부분입금", "예정금액 중 일부만 입금된 상태입니다."],
  ["역발행", "거래처 시스템에서 세금계산서를 역으로 발행하는 방식입니다."],
  ["수정세금계산서", "이미 발행된 세금계산서를 사유에 맞게 수정하는 문서입니다."],
  ["부가세", "공급가액에 붙는 10% 세금입니다."],
  ["공급가액", "부가세를 제외한 상품 또는 서비스 금액입니다."],
  ["매출 인식", "거래가 회사 매출로 잡히는 기준입니다."],
  ["월마감", "한 달의 입고, 출고, 계산서, 수금 흐름을 정리하는 절차입니다."],
  ["계산서매칭", "세금계산서와 거래 흐름을 연결하는 작업입니다."],
  ["수금매칭", "입금 흐름과 거래/계산서 흐름을 연결하는 작업입니다."],
  ["가상계산서", "실제 계산서 발행 전 임시로 관리되는 계산서 흐름입니다."]
] as const;

const glossaryDocs: ArticleSeed[] = glossarySeeds.map(([term, meaning]) => ({
    id: `glossary-${term.toLowerCase().replace(/\s+/g, "-")}`,
    category: "glossary",
    title: term,
    description: `${term}의 의미와 Sales가 확인해야 할 업무 포인트입니다.`,
    tags: ["용어사전", term],
    level: "기본",
    readTime: "1분",
    use: [meaning],
    frequent: ["월마감 체크", "수금관리", "VIPS 요청 사유 작성"],
    process: ["용어의 의미를 확인합니다.", "관련 메뉴에서 실제 거래 상태를 봅니다.", "요청이나 메모에 같은 표현을 사용합니다."],
    checks: ["□ 어떤 메뉴에서 쓰이는 용어인가", "□ 금액과 상태 중 무엇을 뜻하는가", "□ 요청 사유에 정확히 적었는가"],
    mistakes: ["× 비슷한 용어를 혼용함", "× 뜻을 모르고 요청 사유에 그대로 복사함"],
    tip: [`${term}은 문서 용어가 아니라 실제 거래 상태를 설명하는 말입니다.`],
    relatedArticleIds: relatedForTerm(term)
  }));

export const wikiCategoryLabels: Record<WikiCategory, string> = {
  iki: "IKI 사용법",
  ops: "OPS 운영가이드",
  tax: "세금계산서 / 회계기초",
  faq: "운영 FAQ",
  mistake: "실수사례",
  glossary: "회사 용어 사전"
};

const baseArticles = [
  ...articleSeeds,
  ...taxSeeds,
  ...faqSeeds,
  ...mistakeSeeds,
  ...glossaryDocs
].map(makeArticle);

export const wikiArticles: WikiArticle[] = baseArticles.map((article) => ({
  ...article,
  relatedArticleIds: completeRelated(article.id, article.relatedArticleIds ?? [])
}));

function taxSeed(
  id: string,
  title: string,
  description: string,
  tags: string[],
  use: string,
  frequent: string,
  process: string[],
  mistakes: string[],
  tip: string
): ArticleSeed {
  return {
    id,
    category: "tax",
    title,
    description,
    tags,
    level: title.includes("수정") || title.includes("부분입금") || title.includes("Deduct") ? "필수" : "기본",
    use: [use],
    frequent: [frequent],
    process,
    checks: process.map((item) => `□ ${item}`),
    mistakes: mistakes.map((item) => `× ${item}`),
    tip: [tip],
    relatedArticleIds: ["ops-month-end", "ops-request", "ops-collections"],
    relatedRoutes: [route.monthEnd, route.collections, route.requests]
  };
}

function faqSeed(id: string, title: string, causes: string[], checks: string[], relatedArticleIds: string[]): ArticleSeed {
  return {
    id,
    category: "faq",
    title,
    description: `${title.replace(/[.?]/g, "")} 상황에서 먼저 확인해야 할 기준입니다.`,
    tags: ["FAQ", ...checks],
    use: ["VIPS팀에 문의하기 전 원인을 빠르게 좁힐 때 사용합니다."],
    frequent: causes,
    process: ["원인을 먼저 확인합니다.", ...checks.map((item) => `${item} 확인`), "필요한 메뉴에서 요청 또는 확인 완료를 진행합니다."],
    checks: checks.map((item) => `□ ${item}`),
    mistakes: ["× 화면 확인 없이 바로 문의함", "× 금액과 거래처를 같이 확인하지 않음", "× 처리 후 메모를 남기지 않음"],
    tip: ["문의할 때는 거래처명, 금액, 링크, 확인한 화면을 함께 남기면 처리 시간이 줄어듭니다."],
    relatedArticleIds,
    relatedRoutes: [route.monthEnd, route.collections, route.requests]
  };
}

function mistakeSeed(id: string, title: string, situation: string, cause: string, result: string, relatedArticleIds: string[]): ArticleSeed {
  return {
    id,
    category: "mistake",
    title,
    description: "실제 업무에서 반복되기 쉬운 실수를 OPS 기준으로 정리했습니다.",
    tags: ["실수사례", ...title.split(" ").slice(0, 3)],
    level: "중급",
    use: [situation],
    frequent: ["월마감 전", "VIPS 요청 전", "수금 확인 전"],
    process: ["상황을 확인합니다.", "원인을 찾습니다.", "결과를 확인합니다.", "OPS에서 같은 실수를 막을 체크포인트를 봅니다."],
    checks: ["□ 거래처와 금액을 확인했는가", "□ 계산서/수금/매칭 중 빠진 것이 있는가", "□ 사유와 메모를 남겼는가"],
    mistakes: [`× ${cause}`],
    tip: [result, "출고가 끝났다고 거래가 종료된 것은 아닙니다."],
    relatedArticleIds,
    relatedRoutes: [route.monthEnd, route.collections, route.requests]
  };
}

function makeArticle(seed: ArticleSeed): WikiArticle {
  const sections = seed.category === "glossary"
    ? [
        { heading: "의미", body: seed.use },
        { heading: "언제 사용하는지", body: seed.frequent.map((item) => `${item}에서 사용합니다.`) },
        { heading: "관련 메뉴", body: seed.frequent },
        { heading: "체크포인트", body: seed.checks },
        { heading: "자주 하는 실수", body: seed.mistakes },
        { heading: "VIPS TIP", body: seed.tip }
      ]
    : [
        { heading: "언제 사용하는가", body: seed.use },
        { heading: "언제 가장 많이 사용하는가", body: seed.frequent },
        { heading: "처리 순서", body: seed.process.map((item, index) => `${index + 1}. ${item}`) },
        { heading: "체크포인트", body: seed.checks },
        { heading: "자주 하는 실수", body: seed.mistakes },
        { heading: "VIPS TIP", body: seed.tip }
      ];

  return {
    id: seed.id,
    category: seed.category,
    title: seed.title,
    description: seed.description,
    tags: seed.tags,
    level: seed.level ?? "기본",
    readTime: seed.readTime ?? (seed.category === "glossary" ? "1분" : seed.level === "중급" ? "5분" : "3분"),
    target: "Sales 전체",
    status: seed.status ?? "published",
    updatedAt,
    version: "v1.0",
    relatedArticleIds: seed.relatedArticleIds,
    relatedRoutes: seed.relatedRoutes ?? defaultRoutes(seed.category),
    checklist: seed.checks,
    mistakes: seed.mistakes,
    tips: seed.tip,
    sections
  };
}

function defaultRoutes(category: WikiCategory) {
  if (category === "ops") return [route.monthEnd, route.collections, route.requests];
  if (category === "tax") return [route.monthEnd, route.requests];
  if (category === "faq") return [route.monthEnd, route.collections, route.requests];
  if (category === "mistake") return [route.monthEnd, route.collections, route.requestStatus];
  return [route.monthEnd, route.collections, route.requests];
}

function relatedForTerm(term: string) {
  if (["AR", "미수금", "부분입금", "수금매칭"].includes(term)) return ["ops-collections", "ops-collection-match", "tax-partial-payment"];
  if (["Deduct", "월마감", "매출 인식"].includes(term)) return ["ops-month-end", "tax-deduct", "tax-month-end-importance"];
  if (["수정세금계산서", "역발행", "부가세", "공급가액", "가상계산서"].includes(term)) return ["tax-revise", "tax-issue-timing", "ops-request"];
  if (["Booking", "Billing", "BOM"].includes(term)) return ["iki-order", "iki-tracking-search", "tax-revenue-recognition"];
  if (["EMS", "PCB", "SMT", "MOQ", "MOA", "NCNR"].includes(term)) return ["iki-order", "iki-order-attachment", "ops-request"];
  if (["RMA"].includes(term)) return ["iki-rma", "tax-revise", "ops-month-end"];
  if (["EXR"].includes(term)) return ["iki-order", "tax-supply-vat", "ops-request"];
  if (["COC"].includes(term)) return ["iki-coc", "iki-order-coc-request", "ops-request"];
  return ["ops-month-end", "ops-collections", "ops-request"];
}

function completeRelated(id: string, current: string[]) {
  const fallback = ["ops-month-end", "ops-collections", "ops-request", "tax-revise", "tax-deduct", "ops-invoice-match", "ops-collection-match", "mistake-1"];
  const merged = [...current, ...fallback].filter((item) => item !== id);
  return Array.from(new Set(merged)).slice(0, 5);
}

