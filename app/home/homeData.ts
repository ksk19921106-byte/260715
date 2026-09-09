import {
  Banknote,
  CreditCard,
  FileText,
  Landmark,
  PackageCheck,
  Truck,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import type { RequestKind } from "../services/formValidation";

export const summary = {
  totalNeedCheckCount: 8,
  totalNeedCheckAmount: 86577903,
  monthlyNeedCount: 6,
  collectionNeedCount: 1,
  delayedRequestCount: 1
};

export type WorkItemType = "common" | "monthClose" | "collection" | "request" | "notice" | "issue";
export type WorkItemStatus = "notStarted" | "inProgress" | "needCheck" | "done" | "delayed";

export type WorkItem = {
  id: string;
  title: string;
  description?: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: "high" | "medium" | "low";
  date: string;
  repeat?: "weekly" | "monthly" | "none";
  target: "all" | "sales" | "vips" | "admin";
  owner?: string;
  source: "manual" | "opsData" | "system";
  relatedRoute?: string;
};

export const weeklyWorkItems: WorkItem[] = [
  {
    id: "weekly-wr",
    title: "WR 작성",
    description: "주간 업무 리포트",
    type: "common",
    status: "notStarted",
    priority: "medium",
    date: "월",
    repeat: "weekly",
    target: "all",
    source: "manual"
  },
  {
    id: "month-start",
    title: "월마감 시작",
    description: "오늘부터 월마감 시작",
    type: "monthClose",
    status: "needCheck",
    priority: "high",
    date: "화",
    repeat: "monthly",
    target: "sales",
    source: "system",
    relatedRoute: "/month-end"
  },
  {
    id: "month-focus",
    title: "월마감 체크",
    description: "월말 기간 집중 점검",
    type: "monthClose",
    status: "inProgress",
    priority: "high",
    date: "수",
    repeat: "monthly",
    target: "sales",
    source: "opsData",
    relatedRoute: "/month-end"
  },
  {
    id: "collection-check",
    title: "수금 확인",
    description: "수금 이슈 1건",
    type: "collection",
    status: "needCheck",
    priority: "high",
    date: "목",
    repeat: "none",
    target: "sales",
    source: "opsData",
    relatedRoute: "/collections"
  },
  {
    id: "request-delay",
    title: "반려/지연 확인",
    description: "요청 이슈 1건",
    type: "request",
    status: "delayed",
    priority: "medium",
    date: "금",
    repeat: "none",
    target: "sales",
    source: "opsData",
    relatedRoute: "/request-status"
  }
];

export const searchChips = ["수정세금계산서", "선수금", "보증보험", "수금매칭", "계산서매칭"];

export const monthlyItems = [
  { key: "invoice_required", label: "출고/계산서X", count: "3건", amount: "79,895,946원", icon: FileText, tone: "needCheck" },
  { key: "shipment_check", label: "입고/출고X/계산서O", count: "2건", amount: "5,252,933원", icon: Truck, tone: "inProgress" },
  { key: "long_pending", label: "입고/출고X/계산서X", count: "4건", amount: "상태: 입고 완료", icon: PackageCheck, tone: "info" },
  { key: "rma", label: "RMA", count: "1건", amount: "75,000원", icon: PackageCheck, tone: "needCheck" }
];

export const collectionItems = [
  { label: "수금 확인 필요", count: "1건", sub: "1,429,024원", icon: WalletCards, tone: "needCheck" },
  { label: "수금매칭 보류", count: "2건", sub: "부분입금 확인", icon: Banknote, tone: "inProgress" },
  { label: "입금매칭 오류", count: "1건", sub: "입금자명 확인", icon: CreditCard, tone: "needCheck" }
];

export const quickRequests: Array<{ kind: RequestKind; label: string; icon: LucideIcon; tone: string }> = [
  { kind: "taxInvoice", label: "세금계산서\n발행 요청", icon: FileText, tone: "info" },
  { kind: "revisedTaxInvoice", label: "수정세금계산서\n요청", icon: FileText, tone: "info" },
  { kind: "advancePayment", label: "선수금 처리\n요청", icon: Landmark, tone: "info" },
  { kind: "invoiceMatching", label: "계산서매칭", icon: FileText, tone: "info" }
];

export function toneClass(tone: string) {
  if (tone === "needCheck" || tone === "red") return "bg-[#fff5ec] text-[#F39945]";
  if (tone === "inProgress" || tone === "orange") return "bg-[#fff5ec] text-[#F39945]";
  if (tone === "done" || tone === "green") return "bg-[#edf4ff] text-[#1D50A2]";
  return "bg-[#f1f5f9] text-[#64748b]";
}

