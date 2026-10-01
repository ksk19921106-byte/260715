import type { ClosingIssue, ClosingSnapshot } from "./closingPasteParser";
import type { PortalUser } from "./portalUsers";

export type ReviewAction = "memo" | "submit" | "approve" | "reject";
export const reviewLabels = { draft: "미완료", pending: "VIPS 검토 대기", approved: "승인 완료", rejected: "반려" };
export function canReviewMonthEnd(user: Pick<PortalUser, "role" | "accessRole">) {
  return user.role === "VIPS" || user.accessRole === "admin";
}
export function ownsMonthEndIssue(issue: ClosingIssue, user: Pick<PortalUser, "salesName">) {
  const name = user.salesName.trim().toLowerCase();
  return Boolean(name) && [issue.iSales, issue.fSales].some((value) => value.trim().toLowerCase() === name);
}
export function reviewLabel(issue: ClosingIssue) {
  return issue.review ? reviewLabels[issue.review.state] : issue.status === "done" ? "완료 (기존 기록)" : issue.status === "dismissed" ? "제외" : "미완료";
}
export function reviewVersion(issue: ClosingIssue) {
  return JSON.stringify([issue.status, issue.memo || "", issue.review?.updatedAt || "", issue.review?.history?.length || 0]);
}

export function transitionMonthEndReview(issue: ClosingIssue, user: PortalUser, action: ReviewAction, note: string, at: string): ClosingIssue {
  const reviewer = canReviewMonthEnd(user);
  if (action === "approve" || action === "reject") {
    if (!reviewer) throw new Error("완료 승인과 반려는 VIPS팀만 할 수 있습니다.");
  } else if (!reviewer && !ownsMonthEndIssue(issue, user)) throw new Error("본인 담당 건만 변경할 수 있습니다.");
  if ((action === "memo" || action === "submit") && issue.status !== "open") throw new Error("완료된 건은 VIPS팀의 재확인이 필요합니다.");
  if (action === "submit" && issue.review?.state === "pending") throw new Error("이미 VIPS팀 검토를 기다리고 있습니다.");
  if (action === "approve" && issue.status !== "open") throw new Error("이미 완료되었거나 제외된 건입니다.");
  if (action === "reject" && !note.trim()) throw new Error("반려 사유를 입력해주세요.");
  const history = [...(issue.review?.history || []), { action, actor: user.name, at, note }];
  const review: NonNullable<ClosingIssue["review"]> = { ...issue.review, state: "draft", updatedAt: at, history };
  if (action === "memo") {
    review.state = issue.review?.state === "rejected" ? "rejected" : "draft";
    return { ...issue, memo: note, review };
  }
  if (action === "submit") {
    return { ...issue, status: "open", review: { ...review, state: "pending", submittedBy: user.name, submittedAt: at } };
  }
  return { ...issue, status: action === "approve" ? "done" : "open", review: { ...review, state: action === "approve" ? "approved" : "rejected", reviewedBy: user.name, reviewedAt: at, reason: note.trim() } };
}

export async function saveMonthEndReview(snapshotId: string, issue: ClosingIssue, viewer: string, action: ReviewAction, note = "") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`/api/month-end-snapshot?viewer=${encodeURIComponent(viewer)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ snapshotId, issueId: issue.id, action, note, version: reviewVersion(issue) })
    });
    const data = await response.json();
    if (!response.ok || !data.snapshot) throw new Error(data.message || "공용 저장소에 반영하지 못했습니다.");
    try { window.localStorage.setItem("icbanq.ops.monthEnd.latestSnapshot", JSON.stringify(data.snapshot)); } catch { /* Server save is authoritative. */ }
    window.dispatchEvent(new Event("month-end-review-changed"));
    return data.snapshot as ClosingSnapshot;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("저장 응답이 늦어지고 있습니다. 새로고침 후 반영 여부를 확인해주세요.");
    throw error;
  } finally { clearTimeout(timeout); }
}
