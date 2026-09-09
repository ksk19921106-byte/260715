import type { ClosingIssue } from "./closingPasteParser";

const STORAGE_KEY = "icbanq.monthEndActionRequests.v1";

export type MonthEndActionStatus = "received" | "inProgress" | "done";

export type MonthEndActionRequest = {
  id: string;
  issueId: string;
  issueType: ClosingIssue["issueType"];
  issueLabel: string;
  team: string;
  fSales: string;
  iSales: string;
  company: string;
  amount: number;
  gpdAmount?: number;
  gpRate?: number;
  memo: string;
  requestedBy: string;
  requestedAt: string;
  status: MonthEndActionStatus;
  erpSyncStatus: "mock" | "pending" | "synced";
};

function readRawRequests() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRequests(requests: MonthEndActionRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new Event("month-end-action-requests-updated"));
}

export function fetchMonthEndActionRequests() {
  return readRawRequests() as MonthEndActionRequest[];
}

export function saveMonthEndActionRequest(input: {
  issue: ClosingIssue;
  memo: string;
  requestedBy: string;
}) {
  const requests = fetchMonthEndActionRequests();
  const now = new Date().toISOString();
  const existingIndex = requests.findIndex((request) => request.issueId === input.issue.id);
  const nextRequest: MonthEndActionRequest = {
    id: existingIndex >= 0 ? requests[existingIndex].id : `month-end-action-${Date.now()}`,
    issueId: input.issue.id,
    issueType: input.issue.issueType,
    issueLabel: input.issue.issueLabel,
    team: input.issue.team,
    fSales: input.issue.fSales,
    iSales: input.issue.iSales,
    company: input.issue.company,
    amount: input.issue.amount,
    gpdAmount: input.issue.gpdAmount,
    gpRate: input.issue.gpRate,
    memo: input.memo || "출고 진행 확인",
    requestedBy: input.requestedBy,
    requestedAt: existingIndex >= 0 ? requests[existingIndex].requestedAt : now,
    status: existingIndex >= 0 ? requests[existingIndex].status : "received",
    erpSyncStatus: "mock"
  };

  const nextRequests = existingIndex >= 0
    ? requests.map((request, index) => (index === existingIndex ? nextRequest : request))
    : [nextRequest, ...requests];

  writeRequests(nextRequests);
  return nextRequest;
}

export function updateMonthEndActionRequestStatus(id: string, status: MonthEndActionStatus) {
  const nextRequests = fetchMonthEndActionRequests().map((request) => (
    request.id === id ? { ...request, status } : request
  ));
  writeRequests(nextRequests);
  return nextRequests;
}
