import type { ClosingSnapshot } from "./closingPasteParser";
import { normalizeSalesName } from "./receivables";
import { progressCycle, type ProgressEvidence } from "./opsProgress";
import { getLocalDateKey } from "./opsActionSchedule";

type Row = { id?: string; sales?: string; fSales?: string; amount?: number; ar?: number; diff?: number; status?: string; company?: string; supplier?: string; purchaseStatus?: string; warehouseStatus?: string };
type Snapshot = { uploadedAt?: string; records?: Row[] };
export type ProgressSources = {
  closing: ClosingSnapshot | null;
  rma: Snapshot | null;
  ar: Snapshot | null;
  collection: Snapshot | null;
  matching: { uploadedAt?: string; assignments?: Record<string, string>; demo?: { payments?: Array<{ id: string; status: string; amount?: number }> } } | null;
};

function own(value: string | undefined, name: string) {
  return normalizeSalesName(value).toLowerCase() === name.toLowerCase();
}

export function buildProgressEvidence(sources: ProgressSources, task: string, name: string, date: string): ProgressEvidence {
  const pending: string[] = [];
  const missing: string[] = [];
  let total = 0;
  const cycle = progressCycle(date);
  const valid = (snapshot: { uploadedAt?: string } | null) => {
    if (!snapshot?.uploadedAt || Number.isNaN(Date.parse(snapshot.uploadedAt))) return false;
    const uploadedDate = getLocalDateKey(new Date(snapshot.uploadedAt));
    return uploadedDate <= date && progressCycle(uploadedDate) === cycle;
  };
  if (task.includes("duplicate-sales") || task.includes("tax-billing") || task === "closing-d1-report") {
    return { known: false, pending: [], missing: ["담당자 직접 확인"] };
  }
  const closing = sources.closing;
  if (!closing || closing.closingMonth !== cycle || !closing.uploadedAt || Number.isNaN(Date.parse(closing.uploadedAt)) || getLocalDateKey(new Date(closing.uploadedAt)) > date) missing.push("해당 마감월 월마감 자료");
  else {
    closing.issues.filter((issue) => {
      if (!own(issue.iSales, name) && !own(issue.fSales, name)) return false;
      if (task.startsWith("month-end-d")) return ["shipment_check", "long_pending", "sales_unshipped"].includes(issue.issueType);
      return issue.issueType !== "collection_check";
    }).forEach((issue) => {
      total += 1;
      if (issue.status === "done" || issue.status === "dismissed") return;
      pending.push(JSON.stringify(["월마감", issue.sourceRowId, issue.company, issue.iSales, issue.fSales, issue.issueType, issue.amount]));
    });
  }
  if (task === "month-end-review" || task === "month-end-d3-unshipped") return { known: missing.length === 0, pending, missing, total };

  function collect(label: string, snapshot: Snapshot | null, filter: (row: Row) => boolean) {
    if (!valid(snapshot) || !Array.isArray(snapshot?.records)) { missing.push(label); return; }
    snapshot.records.filter((row) => own(row.sales, name) || own(row.fSales, name)).forEach((row) => {
      total += 1;
      if (filter(row)) pending.push(JSON.stringify([label, row.id || row.company || row.supplier, row.ar ?? row.diff ?? row.amount, row.status, row.purchaseStatus, row.warehouseStatus]));
    });
  }
  if (task === "month-end-dday-unshipped-collection") {
    collect("수금", sources.collection, (row) => Number(row.diff) > 0);
  } else {
    collect("AR", sources.ar, (row) => Number(row.ar) > 0);
    collect("RMA", sources.rma, () => true);
    const matching = sources.matching;
    if (!valid(matching) || !Array.isArray(matching?.demo?.payments)) missing.push("수금 미매칭 자료");
    else matching.demo.payments.forEach((payment) => {
      const assignee = matching.assignments?.[payment.id];
      if (!assignee && payment.status !== "matched") { if (!missing.includes("미매칭 입금 담당자")) missing.push("미매칭 입금 담당자"); }
      else if (own(assignee, name)) {
        total += 1;
        if (payment.status !== "matched") pending.push(JSON.stringify(["미매칭", payment.id, payment.amount]));
      }
    });
  }
  return { known: missing.length === 0, pending: Array.from(new Set(pending)).sort(), missing, total };
}
