"use client";

import { useState } from "react";
import type { ClosingSnapshot } from "../services/closingPasteParser";
import type { PortalUser } from "../services/portalUsers";
import { MonthEndReviewControls } from "./MonthEndReviewControls";

export function MonthEndReviewQueue({ snapshot, user, onSaved }: { snapshot: ClosingSnapshot | null; user: PortalUser; onSaved: (snapshot: ClosingSnapshot) => void }) {
  const [filter, setFilter] = useState("waiting");
  const [query, setQuery] = useState("");
  const issues = (snapshot?.issues || []).filter((issue) => {
    if (filter === "waiting" && !(issue.status === "open" && (issue.review?.state === "pending" || (issue.memo?.trim() && !["rejected", "approved"].includes(issue.review?.state || ""))))) return false;
    if (filter === "rejected" && issue.review?.state !== "rejected") return false;
    if (filter === "approved" && issue.status !== "done") return false;
    return `${issue.company} ${issue.iSales} ${issue.fSales}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  return <section className="min-w-0 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[18px] font-black">월마감 완료 검토</h2><p className="mt-1 text-[12px] text-[#64748b]">{snapshot?.closingMonth || "-"} 마감 대상 · {issues.length}건</p></div><div className="flex flex-wrap gap-2"><input aria-label="월마감 검토 검색" placeholder="Sales / 거래처 검색" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-44 rounded-lg border px-3 text-[13px]" /><select aria-label="월마감 검토 상태" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border bg-white px-3 text-[13px]"><option value="waiting">검토 대기 · 사유 입력</option><option value="rejected">반려</option><option value="approved">완료</option><option value="all">전체</option></select></div></div>
    <div className="mt-4 max-h-[480px] overflow-auto"><table className="w-full min-w-[720px] text-left text-[12px]"><thead className="sticky top-0 bg-[#f8fbff] text-[#64748b]"><tr><th className="p-3">Sales</th><th className="p-3">거래처 / 월마감 항목</th><th className="p-3">Sales 사유</th><th className="p-3">검토 / 처리 이력</th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.id} className="border-b"><td className="p-3">{issue.iSales}<div className="text-[#64748b]">{issue.fSales}</div></td><td className="p-3">{issue.company}<div className="mt-1 text-[#64748b]">{issue.issueLabel} · {issue.amount.toLocaleString("ko-KR")}원</div></td><td className="max-w-[260px] whitespace-pre-wrap break-words p-3">{issue.memo || "-"}</td><td className="max-w-[320px] p-3"><MonthEndReviewControls snapshotId={snapshot!.id} issue={issue} user={user} onSaved={onSaved} /></td></tr>)}</tbody></table></div>
    {!issues.length ? <p className="py-5 text-center text-[13px] text-[#64748b]">{snapshot ? "해당하는 검토 건이 없습니다." : "월마감 원본을 불러오지 못했습니다."}</p> : null}
  </section>;
}
