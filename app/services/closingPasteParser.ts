export type ClosingIssueType =
  | "invoice_required"
  | "shipment_check"
  | "long_pending"
  | "collection_check"
  | "deduct_check"
  | "sales_unshipped";

export type ClosingIssue = {
  id: string;
  sourceRowId: string;
  team: string;
  fSales: string;
  iSales: string;
  company: string;
  companyCount?: number;
  billingAmount?: number;
  gpdAmount?: number;
  gpRate?: number;
  issueType: ClosingIssueType;
  issueLabel: string;
  amount: number;
  shipmentDays?: number;
  taxIssueDays?: number;
  priority: "high" | "medium" | "low";
  recommendedAction: string;
  uploadedAt: string;
  uploadedBy: string;
  status: "open" | "done" | "dismissed";
  memo?: string;
  erpUrl?: string;
  trackingUrl?: string;
  orderUrl?: string;
};

export type ClosingSnapshot = {
  id: string;
  closingMonth: string;
  uploadedAt: string;
  uploadedBy: string;
  rawText: string;
  issues: ClosingIssue[];
};

export type ClosingParseResult = {
  ok: boolean;
  rowCount: number;
  issues: ClosingIssue[];
  message: string;
  missingColumns: string[];
};

const issueMeta: Record<ClosingIssueType, { label: string; action: string }> = {
  invoice_required: {
    label: "출고O/계산서X",
    action: "고객사 출고는 완료되었지만 계산서가 미발행된 건입니다. 세금계산서 발행 요청이 필요합니다."
  },
  shipment_check: {
    label: "입고O/출고X/계산서O",
    action: "입고 및 계산서 발행은 완료되었지만 고객에게 출고되지 않은 건입니다. 출고 진행 여부를 확인해주세요."
  },
  long_pending: {
    label: "입고O/출고X/계산서X",
    action: "입고된 건이지만 고객에게 출고 및 계산서 발행이 진행되지 않은 건입니다. 거래 진행 상태를 먼저 확인해주세요."
  },
  collection_check: {
    label: "지연AR",
    action: "AR 지연 금액이 있습니다. 입금 확인 또는 수금관리 확인이 필요합니다."
  },
  deduct_check: {
    label: "Deduct 확인 필요",
    action: "Deduct 금액이 있습니다. Deduct 사유와 반영 여부를 확인해주세요."
  },
  sales_unshipped: {
    label: "세일즈 미출고",
    action: "세일즈 미출고 건입니다. 출고 처리 가능 여부와 보류 사유를 확인해주세요."
  }
};

function normalizeMoney(value: string | undefined) {
  if (!value) return 0;
  const match = value.replace(/,/g, "").replace(/원/g, "").replace(/\s/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
}

function normalizePercent(value: string | undefined) {
  if (!value) return undefined;
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function extractTotalAmount(value: string | undefined) {
  if (!value) return 0;
  const totalMatch = value.replace(/,/g, "").match(/Total:\s*(-?\d+(?:\.\d+)?)/i);
  if (totalMatch) return Math.round(Number(totalMatch[1]));
  return normalizeMoney(value);
}

function normalizeCount(value: string | undefined) {
  if (!value) return undefined;
  const compact = value.replace(/,/g, "");
  const companyCountMatch = compact.match(/(?:업체|company|거래처)[^\d-]*(\d+)/i);
  if (companyCountMatch) return Number(companyCountMatch[1]);
  return undefined;
}

function splitSalesPair(value: string) {
  const normalized = value.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  const parts = normalized.split("/").map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return { fSales: parts[0], iSales: parts.slice(1).join(" / ") };
  }

  const fallback = normalized || "미지정";
  return { fSales: fallback, iSales: fallback };
}

function cleanCompany(value: string | undefined) {
  return (value || "거래처 미확인").replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

function priorityFor(type: ClosingIssueType, amount: number, shipmentDays: number, taxIssueDays: number): "high" | "medium" | "low" {
  if ((type === "invoice_required" || type === "collection_check") && amount >= 1000000) return "high";
  if (taxIssueDays >= 14 || shipmentDays >= 14) return "high";
  if (amount > 0 || Math.max(shipmentDays, taxIssueDays) >= 7) return "medium";
  return "low";
}

function createIssue(params: {
  rowNo: string;
  team: string;
  salesPair: string;
  company: string;
  companyCount?: number;
  billingAmount?: number;
  gpdAmount?: number;
  gpRate?: number;
  type: ClosingIssueType;
  amount: number;
  shipmentDays: number;
  taxIssueDays: number;
  uploadedAt: string;
  uploadedBy: string;
}): ClosingIssue {
  const meta = issueMeta[params.type];
  const { fSales, iSales } = splitSalesPair(params.salesPair);

  return {
    id: `${params.uploadedAt}-${params.rowNo}-${fSales}-${iSales}-${params.type}`,
    sourceRowId: `erp-row-${params.rowNo}`,
    team: params.team || "-",
    fSales,
    iSales,
    company: params.company,
    companyCount: params.companyCount,
    billingAmount: params.billingAmount,
    gpdAmount: params.gpdAmount,
    gpRate: params.gpRate,
    issueType: params.type,
    issueLabel: meta.label,
    amount: params.amount,
    shipmentDays: params.shipmentDays,
    taxIssueDays: params.taxIssueDays,
    priority: priorityFor(params.type, params.amount, params.shipmentDays, params.taxIssueDays),
    recommendedAction: meta.action,
    uploadedAt: params.uploadedAt,
    uploadedBy: params.uploadedBy,
    status: "open"
  };
}

function splitErpRows(text: string) {
  const rows: string[][] = [];
  let current: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    if (/^\d+\t/.test(line)) {
      if (current.length > 0) rows.push(current);
      current = [line];
      continue;
    }

    if (current.length > 0) current.push(line);
  }

  if (current.length > 0) rows.push(current);
  return rows;
}

function parseErpMultiLinePaste(text: string, uploadedBy: string, uploadedAt: string): ClosingParseResult | null {
  const rowBlocks = splitErpRows(text);
  if (rowBlocks.length === 0) return null;

  const issues: ClosingIssue[] = [];
  let parsedRows = 0;

  for (const rowBlock of rowBlocks) {
    const cells = rowBlock.join("\n").split("\t").map((cell) => cell.trim());
    if (cells.length < 14 || !/^\d+$/.test(cells[0])) continue;

    parsedRows += 1;

    const rowNo = cells[0];
    const team = cells[1] || "-";
    const salesPair = cells[2] || "미지정";
    const company = cleanCompany(cells[3]);
    const companyCount = normalizeCount(company);
    const billingAmount = extractTotalAmount(cells[4]);
    const gpdAmount = extractTotalAmount(cells[5]);
    const gpRate = normalizePercent(cells[6]);
    const shipmentDays = normalizeMoney(cells[7]);
    const taxIssueDays = normalizeMoney(cells[8]);

    const issueValues: Array<[ClosingIssueType, number]> = [
      ["collection_check", normalizeMoney(cells[9])],
      ["deduct_check", normalizeMoney(cells[10])],
      ["shipment_check", normalizeMoney(cells[11])],
      ["invoice_required", normalizeMoney(cells[12])],
      ["long_pending", normalizeMoney(cells[13])],
      ["sales_unshipped", normalizeMoney(cells[14])]
    ];

    for (const [type, amount] of issueValues) {
      if (amount <= 0) continue;
      issues.push(
        createIssue({
          rowNo,
          team,
          salesPair,
          company,
          companyCount,
          billingAmount,
          gpdAmount,
          gpRate,
          type,
          amount,
          shipmentDays,
          taxIssueDays,
          uploadedAt,
          uploadedBy
        })
      );
    }
  }

  if (parsedRows === 0) return null;

  return {
    ok: true,
    rowCount: parsedRows,
    issues,
    message: `ERP 복사 데이터 ${parsedRows}개 행을 인식했습니다. 확인 필요 이슈 ${issues.length}건을 생성했습니다.`,
    missingColumns: []
  };
}

export function parseClosingPaste(text: string, uploadedBy = "Sally", uploadedAt = new Date().toISOString()): ClosingParseResult {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return {
      ok: false,
      rowCount: 0,
      issues: [],
      message: "데이터를 인식하지 못했습니다. ERP 월마감 화면에서 표 전체를 복사한 뒤 다시 붙여넣어주세요.",
      missingColumns: ["ERP pasted table"]
    };
  }

  const erpResult = parseErpMultiLinePaste(normalizedText, uploadedBy, uploadedAt);
  if (erpResult) return erpResult;

  return {
    ok: false,
    rowCount: 0,
    issues: [],
    message: "필수 컬럼을 충분히 인식하지 못했습니다. ERP 월마감 화면에서 표 전체를 복사한 뒤 다시 붙여넣어주세요.",
    missingColumns: ["NO", "TEAM", "FSales / ISales", "출고/계산서/AR/Deduct columns"]
  };
}

export function formatKrw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function getIssueActionLabel(issueType: ClosingIssueType) {
  switch (issueType) {
    case "invoice_required":
      return "세금계산서 요청";
    case "shipment_check":
      return "출고 확인";
    case "long_pending":
      return "진행상태 확인";
    case "collection_check":
      return "수금관리 이동";
    case "deduct_check":
      return "Deduct 사유 입력";
    case "sales_unshipped":
      return "출고 처리 확인";
    default:
      return "확인";
  }
}
