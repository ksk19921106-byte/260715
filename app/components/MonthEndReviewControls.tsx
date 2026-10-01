"use client";

import { useState } from "react";
import { CheckCircle2, CircleX, Send } from "lucide-react";
import type { ClosingIssue, ClosingSnapshot } from "../services/closingPasteParser";
import type { PortalUser } from "../services/portalUsers";
import { canReviewMonthEnd, ownsMonthEndIssue, reviewLabel, saveMonthEndReview, type ReviewAction } from "../services/monthEndReview";

export function MonthEndReviewControls({ snapshotId, issue, user, onSaved, disabled = false }: {
  snapshotId: string; issue: ClosingIssue; user: PortalUser; onSaved: (snapshot: ClosingSnapshot) => void; disabled?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const reviewer = canReviewMonthEnd(user);
  async function run(action: ReviewAction) {
    const note = action === "reject" ? window.prompt("Sales가 다시 확인할 수 있도록 반려 사유를 입력해주세요.", "") : "";
    if (note === null) return;
    if (action === "reject" && !note.trim()) { setError("반려 사유를 입력해주세요."); return; }
    setSaving(true); setError("");
    try { onSaved(await saveMonthEndReview(snapshotId, issue, user.name, action, note)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "저장에 실패했습니다. 새로고침 후 상태를 확인해주세요."); }
    finally { setSaving(false); }
  }
  return <div className="min-w-0 text-[11px]">
    <div className="flex flex-wrap items-center gap-2">
      <strong className={issue.review?.state === "rejected" ? "text-[#b91c1c]" : issue.status === "done" ? "text-[#15803d]" : "text-[#1D50A2]"}>{saving ? "저장 중…" : reviewLabel(issue)}</strong>
      {reviewer ? <>
        <button type="button" title="완료 승인" aria-label={`${issue.company} 완료 승인`} disabled={disabled || saving || issue.status !== "open"} onClick={() => void run("approve")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[#15803d] disabled:opacity-40"><CheckCircle2 size={16} /></button>
        <button type="button" title="반려" aria-label={`${issue.company} 반려`} disabled={disabled || saving || issue.status === "dismissed"} onClick={() => void run("reject")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[#b91c1c] disabled:opacity-40"><CircleX size={16} /></button>
      </> : ownsMonthEndIssue(issue, user) && issue.status === "open" ? <button type="button" disabled={disabled || saving || issue.review?.state === "pending"} onClick={() => void run("submit")} className="flex min-h-8 items-center gap-1 rounded-lg border px-2 font-bold text-[#1D50A2] disabled:opacity-40"><Send size={14} />{issue.review?.state === "rejected" ? "완료 재요청" : "완료 요청"}</button> : null}
    </div>
    {issue.review?.state === "rejected" ? <p className="mt-1 break-words text-[#b91c1c]">반려 사유: {issue.review.reason}</p> : null}
    {issue.review?.history?.length ? <details className="mt-1 text-[#64748b]"><summary className="cursor-pointer">처리 이력 ({issue.review.history.length})</summary><ul className="mt-2 space-y-1">{issue.review.history.map((item, index) => <li key={`${item.at}-${index}`} className="break-words">{new Date(item.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {item.actor} · {({ memo: "사유 변경", submit: "완료 요청", approve: "승인", reject: "반려" })[item.action]}{item.note ? ` · ${item.note}` : ""}</li>)}</ul></details> : null}
    {error ? <p role="alert" className="mt-1 break-words text-[#b91c1c]">{error}</p> : null}
  </div>;
}
