import type { TestUser } from "../hooks/useSelectedUser";

export type ReceivableStatus = "완료" | "부분수금" | "미수";
export type CollectionIssueStatus = "미수" | "부분수금" | "미매칭" | "장기미수";
export type CollectionIssueType = "unpaid" | "partial_payment" | "long_overdue" | "unmatched_payment";

export type ReceivableRecord = {
  id: string;
  team: string;
  fSales?: string;
  sales: string;
  name: string;
  expected: number;
  paid: number;
  diff: number;
  rate: number;
  status: ReceivableStatus;
  gubun?: string;
  basis?: string;
  matched_payer?: string;
  collectionMonth?: string;
  dueDate?: string;
  overdueDays: number;
  agingBucket: string;
  erpUrl?: string;
  trackingUrl?: string;
  orderUrl?: string;
  poUrl?: string;
  link?: string;
};

export type CollectionIssue = {
  id: string;
  sales: string;
  company: string;
  amount: number;
  expected: number;
  paid: number;
  diff: number;
  status: CollectionIssueStatus;
  issueType: CollectionIssueType;
  reason: string;
  overdueDays: number;
  priority: "high" | "medium" | "low";
  actionLabel: string;
};

export type ReceivableStat = {
  label: string;
  count: number;
  expected: number;
  paid: number;
  remain: number;
  rate: number;
};

export const SALES_ALIAS_MAP: Record<string, string> = {
  AB: "Abel",
  Abel: "Abel",
  AC: "Ace",
  Ace: "Ace",
  ER: "Eric",
  Eric: "Eric",
  HV: "Harvey",
  Harvey: "Harvey",
  LR: "Lauren",
  Lauren: "Lauren",
  MG: "Morgan",
  Morgan: "Morgan",
  RL: "Riley",
  Riley: "Riley",
  SW: "Swan",
  Swan: "Swan",
  ZK: "Zeke",
  Zeke: "Zeke",
  DN: "Dan",
  Dan: "Dan",
  DO: "Donnie",
  Donnie: "Donnie",
  HT: "Heath",
  Heath: "Heath",
  KV: "Kelvin",
  Kelvin: "Kelvin",
  JC: "Jacob",
  Jacob: "Jacob",
  JE: "Jenny",
  Jenny: "Jenny",
  JL: "Joel",
  Joel: "Joel",
  MX: "Max",
  Max: "Max",
  MO: "Mona",
  Mona: "Mona",
  OS: "Oscar",
  Oscar: "Oscar",
  SA: "Sean",
  Sean: "Sean",
  TR: "Terry",
  Terry: "Terry",
  VC: "Victor",
  Victor: "Victor",
  WN: "Winnie",
  Winnie: "Winnie",
  ZF: "Zeff",
  Zeff: "Zeff",
  CR: "Chris",
  Chris: "Chris",
  JU: "Junny",
  Junny: "Junny",
  LO: "Leo",
  Leo: "Leo",
  SN: "Sonny",
  Sonny: "Sonny",
  TE: "Teo",
  Teo: "Teo",
  OW: "Owen",
  Owen: "Owen",
  RO: "Robin",
  Robin: "Robin",
  RG: "Roger",
  Roger: "Roger",
  SC: "Stacey",
  Stacey: "Stacey",
  SU: "Sunny",
  Sunny: "Sunny",
  YN: "Yena",
  Yena: "Yena",
  Sally: "Sally",
  VN: "Vincent",
  Vincent: "Vincent",
  GA: "Gavin",
  GV: "Gavin",
  Gavin: "Gavin"
};

export function normalizeSalesName(value?: string | null) {
  if (!value) return "";
  const key = String(value).split("/").map((part) => part.trim()).filter(Boolean).pop() || String(value).trim();
  const upperKey = key.toUpperCase();
  const canonicalKey = Object.keys(SALES_ALIAS_MAP).find((alias) => alias.toUpperCase() === upperKey);
  return SALES_ALIAS_MAP[key] || (canonicalKey ? SALES_ALIAS_MAP[canonicalKey] : key);
}

const RECEIVABLE_SALES_FIELD_KEYS = [
  "sales",
  "Sales",
  "SALES",
  "salesName",
  "salesCode",
  "owner",
  "manager",
  "rep",
  "담당자",
  "담당",
  "담당 Sales",
  "담당Sales",
  "담당자명",
  "영업담당",
  "영업",
  "담당 영업"
];

const RECEIVABLE_FSALES_FIELD_KEYS = [
  "fSales",
  "FSales",
  "F Sales",
  "FS",
  "fsales",
  "상위담당",
  "팀장",
  "FSales / ISales",
  "FS / IS",
  "FS/IS"
];

export function readReceivableTextField(record: object | null | undefined, keys: string[]) {
  if (!record) return "";
  const source = record as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function extractReceivableAssignee(record: object | null | undefined) {
  const rawSales = readReceivableTextField(record, RECEIVABLE_SALES_FIELD_KEYS);
  const rawFSales = readReceivableTextField(record, RECEIVABLE_FSALES_FIELD_KEYS);
  const sales = normalizeSalesName(rawSales) || rawSales;
  const fSales = normalizeSalesName(rawFSales) || rawFSales;
  return { rawSales, rawFSales, sales, fSales };
}

export function normalizeTeamName(value?: string | null) {
  if (!value) return "미지정";
  const key = String(value).trim();
  if (key === "영업1팀") return "B2D";
  if (key === "영업2팀") return "S2";
  if (key === "영업3팀") return "S3";
  if (["S1", "S2", "S3", "B2D", "B2M", "B2SU"].includes(key)) return key;
  return key;
}

export const receivableRecords: ReceivableRecord[] = [
  {
    id: "rcv-001",
    team: "영업1팀",
    fSales: "Lauren",
    sales: "Riley",
    name: "파인테크",
    expected: 286597,
    paid: 120000,
    diff: 166597,
    rate: 41.9,
    status: "부분수금",
    gubun: "부분입금",
    basis: "WIN-CMS 입금액 일부 매칭",
    matched_payer: "파인테크",
    overdueDays: 7,
    agingBucket: "14일이내"
  },
  {
    id: "rcv-002",
    team: "영업1팀",
    fSales: "Lauren",
    sales: "Riley",
    name: "제이엠일렉",
    expected: 168626,
    paid: 0,
    diff: 168626,
    rate: 0,
    status: "미수",
    basis: "AR_원본 대조",
    overdueDays: 33,
    agingBucket: "30일초과"
  },
  {
    id: "rcv-003",
    team: "영업1팀",
    fSales: "Lauren",
    sales: "Riley",
    name: "오름전자",
    expected: 100000,
    paid: 0,
    diff: 100000,
    rate: 0,
    status: "미수",
    gubun: "신규매칭",
    basis: "입금자명 유사도 0.78 + 금액 ±1%",
    matched_payer: "오름",
    overdueDays: 4,
    agingBucket: "7일이내"
  },
  {
    id: "rcv-004",
    team: "영업1팀",
    fSales: "Lauren",
    sales: "Harvey",
    name: "나래센서",
    expected: 1429024,
    paid: 0,
    diff: 1429024,
    rate: 0,
    status: "미수",
    basis: "AR_원본 미수",
    overdueDays: 18,
    agingBucket: "21일이내"
  },
  {
    id: "rcv-005",
    team: "영업1팀",
    fSales: "Lauren",
    sales: "ER",
    name: "동양부품",
    expected: 2580000,
    paid: 1250000,
    diff: 1330000,
    rate: 48.4,
    status: "부분수금",
    gubun: "부분입금",
    matched_payer: "동양부품",
    overdueDays: 12,
    agingBucket: "14일이내"
  },
  {
    id: "rcv-006",
    team: "영업2팀",
    fSales: "Sally",
    sales: "Sally",
    name: "에이치컴포넌트",
    expected: 11250000,
    paid: 0,
    diff: 11250000,
    rate: 0,
    status: "미수",
    basis: "고액 AR 미수",
    overdueDays: 42,
    agingBucket: "30일초과"
  },
  {
    id: "rcv-007",
    team: "영업3팀",
    fSales: "Jake",
    sales: "Jake",
    name: "하이테크",
    expected: 5252933,
    paid: 5252933,
    diff: 0,
    rate: 100,
    status: "완료",
    gubun: "기존완료",
    matched_payer: "하이테크",
    overdueDays: 0,
    agingBucket: "7일이내"
  },
  {
    id: "rcv-008",
    team: "영업3팀",
    fSales: "Jake",
    sales: "Jake",
    name: "삼원테크",
    expected: 780000,
    paid: 0,
    diff: 780000,
    rate: 0,
    status: "미수",
    overdueDays: 29,
    agingBucket: "30일이내"
  },
  {
    id: "rcv-009",
    team: "영업1팀",
    fSales: "Lauren",
    sales: "",
    name: "미래디바이스",
    expected: 640000,
    paid: 0,
    diff: 640000,
    rate: 0,
    status: "미수",
    gubun: "담당자미매칭",
    basis: "담당자_DB 미등록",
    matched_payer: "미래디바이스",
    overdueDays: 16,
    agingBucket: "21일이내"
  },
  {
    id: "rcv-010",
    team: "영업2팀",
    fSales: "",
    sales: "",
    name: "세광테크",
    expected: 330000,
    paid: 110000,
    diff: 220000,
    rate: 33.3,
    status: "부분수금",
    gubun: "신규매칭",
    basis: "입금자명 유사도 0.72 + 금액 일부 일치",
    matched_payer: "세광",
    overdueDays: 9,
    agingBucket: "14일이내"
  }
];

export function formatKrwShort(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function filterReceivablesByUser(records: ReceivableRecord[], currentUser: TestUser) {
  if (currentUser.accessRole === "admin" || currentUser.team === "VIPS팀") return records;
  const userSales = normalizeSalesName(currentUser.salesName);
  if (currentUser.accessRole === "manager") {
    return records.filter((record) => {
      const recordSales = normalizeSalesName(record.sales);
      const recordFSales = normalizeSalesName(record.fSales);
      return Boolean(recordSales) && (record.team === currentUser.team || recordFSales === userSales);
    });
  }
  return records.filter((record) => normalizeSalesName(record.sales) === userSales);
}

export function getCollectionPriority(issue: Pick<CollectionIssue, "amount" | "overdueDays" | "status">): CollectionIssue["priority"] {
  if (issue.amount >= 10000000) return "high";
  if (issue.overdueDays >= 30) return "high";
  if (issue.overdueDays >= 14) return "medium";
  if (issue.status === "부분수금") return "medium";
  return "low";
}

function makeIssue(record: ReceivableRecord, params: {
  suffix: string;
  status: CollectionIssueStatus;
  issueType: CollectionIssueType;
  reason: string;
  actionLabel: string;
  amount?: number;
}) {
  const issue = {
    id: `${record.id}-${params.suffix}`,
    sales: record.sales,
    company: record.name,
    amount: params.amount ?? record.diff,
    expected: record.expected,
    paid: record.paid,
    diff: record.diff,
    status: params.status,
    issueType: params.issueType,
    reason: params.reason,
    overdueDays: record.overdueDays,
    priority: "low" as const,
    actionLabel: params.actionLabel
  };

  return { ...issue, priority: getCollectionPriority(issue) };
}

export function buildCollectionIssues(records: ReceivableRecord[]) {
  const issues: CollectionIssue[] = [];

  for (const record of records) {
    if (record.status === "미수") {
      issues.push(makeIssue(record, {
        suffix: "unpaid",
        status: "미수",
        issueType: "unpaid",
        reason: "미수금 확인 필요",
        actionLabel: "입금 확인"
      }));
    }

    if (record.status === "부분수금") {
      issues.push(makeIssue(record, {
        suffix: "partial",
        status: "부분수금",
        issueType: "partial_payment",
        reason: "부분입금 확인 필요",
        actionLabel: "부분입금 확인"
      }));
    }

    if (record.status !== "완료" && record.overdueDays >= 30) {
      issues.push(makeIssue(record, {
        suffix: "long",
        status: "장기미수",
        issueType: "long_overdue",
        reason: "30일 초과 장기 미수",
        actionLabel: "장기미수 확인"
      }));
    }

    if (record.gubun === "신규매칭") {
      issues.push(makeIssue(record, {
        suffix: "match",
        status: "미매칭",
        issueType: "unmatched_payment",
        reason: "입금자명 매칭 확인 필요",
        actionLabel: "매칭 확인"
      }));
    }
  }

  return issues.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.priority] - rank[b.priority] || b.amount - a.amount || b.overdueDays - a.overdueDays;
  });
}

export function buildCollectionSummary(records: ReceivableRecord[]) {
  const issues = buildCollectionIssues(records);
  const expected = records.reduce((sum, record) => sum + record.expected, 0);
  const completedAmount = records.filter((record) => record.status === "완료").reduce((sum, record) => sum + record.expected, 0);
  const unpaidAmount = records.filter((record) => record.status !== "완료").reduce((sum, record) => sum + record.diff, 0);
  const longOverdueCount = records.filter((record) => record.status !== "완료" && record.overdueDays >= 30).length;
  const unmappedCount = records.filter((record) => !normalizeSalesName(record.sales)).length;

  return {
    issueCount: issues.length,
    unpaidAmount,
    collectionRate: expected > 0 ? Math.round((completedAmount / expected) * 1000) / 10 : 0,
    longOverdueCount,
    unmappedCount,
    expected,
    paid: records.reduce((sum, record) => sum + record.paid, 0),
    completedAmount,
    issues
  };
}

export function buildCollectionComposition(records: ReceivableRecord[]) {
  const completedRecords = records.filter((record) => record.status === "완료");
  const partialRecords = records.filter((record) => record.status === "부분수금");
  const unpaidRecords = records.filter((record) => record.status === "미수");
  const totalExpected = records.reduce((sum, record) => sum + record.expected, 0);
  const completedAmount = completedRecords.reduce((sum, record) => sum + record.expected, 0);
  const partialDiff = partialRecords.reduce((sum, record) => sum + record.diff, 0);
  const unpaidAmount = unpaidRecords.reduce((sum, record) => sum + record.expected, 0);

  return {
    totalRecords: records.length,
    totalExpected,
    completedRecords,
    partialRecords,
    unpaidRecords,
    completedAmount,
    partialDiff,
    unpaidAmount,
    needCheckAmount: partialDiff + unpaidAmount,
    collectionRate: totalExpected > 0 ? Math.round((completedAmount / totalExpected) * 1000) / 10 : 0
  };
}

export function buildTeamStats(records: ReceivableRecord[]): ReceivableStat[] {
  const stats = buildStats(records, (record) => normalizeTeamName(record.team));
  const order = ["S1", "S2", "S3", "B2D"];
  return order.map((team) => stats.find((row) => row.label === team) ?? { label: team, count: 0, expected: 0, paid: 0, remain: 0, rate: 0 });
}

export function buildSalesStats(records: ReceivableRecord[]): ReceivableStat[] {
  return buildStats(records, (record) => normalizeSalesName(record.sales) || "미매칭");
}

function buildStats(records: ReceivableRecord[], getLabel: (record: ReceivableRecord) => string) {
  const map = new Map<string, ReceivableStat>();
  for (const record of records) {
    const label = getLabel(record);
    const stat = map.get(label) ?? { label, count: 0, expected: 0, paid: 0, remain: 0, rate: 0 };
    stat.count += 1;
    stat.expected += record.expected;
    stat.paid += record.paid;
    stat.remain += record.status === "완료" ? 0 : record.diff;
    stat.rate = stat.expected > 0 ? Math.round((stat.paid / stat.expected) * 1000) / 10 : 0;
    map.set(label, stat);
  }
  return Array.from(map.values()).sort((a, b) => b.expected - a.expected);
}
