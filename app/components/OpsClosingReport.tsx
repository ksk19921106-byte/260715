"use client";

import { useMemo, useState } from "react";
import { buildClosingReport, closingStages } from "../services/opsClosingReport";
import { progressCycle, type ProgressRecord } from "../services/opsProgress";
import { getSalesTeam } from "../services/organization";
import { statusColors, statusLabels } from "../services/opsCalendar";

type Props = { records: ProgressRecord[]; month: string; members: string[]; today: string; onSelect: (date: string, task: string) => void };

export function OpsClosingReport({ records, month, members, today, onSelect }: Props) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => buildClosingReport(records, month, members, today), [records, month, members, today]);
  const stages = closingStages(month);
  const results = ["1차 완료 기록", "2차 완료 기록", "3차 완료 기록", "최종 완료 기록", "진행 중", "미완료", "재확인 필요", "자동 재판정 대기", "평가 대기"];
  const visible = rows.filter((row) => (filter === "all" || row.result === filter) && row.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="pt-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-[18px] font-black">Sales 마감 리포트</h3><p className="mt-1 text-[12px] text-[#64748b]">{progressCycle(`${month}-10`)} 마감 대상 · {month} 점검 기록 · {members.length}명</p></div>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Sales 검색" placeholder="Sales 검색" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-40 rounded-lg border px-3 text-[13px]" />
        <select aria-label="마감 결과 필터" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 max-w-full rounded-lg border bg-white px-3 text-[13px]"><option value="all">전체 결과 ({rows.length}명)</option>{results.map((value) => <option key={value} value={value}>{value} ({rows.filter((row) => row.result === value).length}명)</option>)}</select>
      </div>
    </div>
    <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-[13px]">
      {stages.map((stage) => <span key={stage.id}>{stage.label} 최초 완료 <strong className="text-[#1D50A2]">{rows.filter((row) => row.first?.id === stage.id).length}명</strong></span>)}
      <span>완료 기록 없음 <strong>{rows.filter((row) => !row.first).length}명</strong></span>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-[13px]">
      <thead className="border-y bg-[#f8fbff] text-[#64748b]"><tr><th className="p-3">Sales / 팀</th>{stages.map((stage) => <th key={stage.id} className="p-3">{stage.label}<div className="text-[11px] font-normal">{stage.date.slice(5).replace("-", "/")}</div></th>)}<th className="p-3">최초 완료 기록</th><th className="p-3">최신 기록 기준</th></tr></thead>
      <tbody>{visible.map((row) => <tr key={row.name} className="border-b border-[#edf1f7]">
        <th scope="row" className="p-3">{row.name}<div className="mt-1 text-[11px] font-normal text-[#64748b]">{getSalesTeam(row.name, "-")}</div></th>
        {row.checks.map((check) => <td key={check.id} className="p-3"><button type="button" title={`${row.name} ${check.label} 점검 기록`} onClick={() => onSelect(check.date, check.id)} className="text-left underline decoration-[#dce6f3] underline-offset-4">
          <span className={check.record && check.record.status !== "auto" ? statusColors[check.record.status] : "text-[#64748b]"}>{check.date > today ? "예정" : !check.record ? "기록 없음" : check.record.status === "auto" ? "자동 재판정" : statusLabels[check.record.status]}</span>
          {check.record ? <span className="mt-1 block text-[11px] text-[#64748b]">{check.record.updatedBy}{check.lateEntry ? " · 사후 입력" : ""}</span> : null}
        </button></td>)}
        <td className="p-3 font-bold">{row.first ? <>{row.first.label}<span className="mt-1 block text-[11px] font-normal text-[#64748b]">{row.first.date}{row.first.lateEntry ? " · 사후 입력" : ""}</span></> : "평가 대기"}</td>
        <td className={`p-3 font-bold ${row.reopened ? "text-[#b45309]" : "text-[#1D50A2]"}`}>{row.result}</td>
      </tr>)}</tbody>
    </table></div>
    {!visible.length ? <p className="py-8 text-center text-[13px] text-[#64748b]">해당하는 Sales가 없습니다.</p> : null}
    <p className="mt-4 text-[12px] leading-5 text-[#64748b]">집계 근거: 차수별 저장된 점검 기록. 자동 판정만 있고 저장 기록이 없는 차수는 평가 대기입니다. ‘기록 없음’은 미완료를 뜻하지 않으며, 사후 입력은 실제 처리 시점을 증명하지 않습니다. 최초 완료 이후의 추가 기록이 없으면 완료 유지 여부는 확정되지 않습니다.</p>
  </div>;
}
