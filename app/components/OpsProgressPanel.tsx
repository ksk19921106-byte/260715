"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleX, Clock3, RotateCcw, RefreshCw, ChevronLeft, ChevronRight, CalendarDays, ChartNoAxesColumn } from "lucide-react";
import { useSelectedUser } from "../hooks/useSelectedUser";
import { getOperationsScope, getSalesTeam } from "../services/organization";
import { getLocalDateKey } from "../services/opsActionSchedule";
import { progressCycle, progressTasks, resolveProgress, validProgressDate, type ProgressRecord, type ProgressStatus } from "../services/opsProgress";
import { buildProgressEvidence, type ProgressSources } from "../services/opsProgressEvidence";
import { calendarStatuses, combineTaskStatuses, monthDates, shiftCalendarMonth, shortTaskTitle, statusColors, statusLabels, type CalendarStatus } from "../services/opsCalendar";
import { OpsProgressCalendar, type CalendarDay } from "./OpsProgressCalendar";
import { OpsClosingReport } from "./OpsClosingReport";

const emptySources: ProgressSources = { closing: null, rma: null, ar: null, collection: null, matching: null };

export function OpsProgressPanel() {
  const { selectedUser } = useSelectedUser();
  const scope = useMemo(() => getOperationsScope(selectedUser), [selectedUser]);
  const [date, setDate] = useState(getLocalDateKey);
  const [today, setToday] = useState(getLocalDateKey);
  const [teamFilter, setTeamFilter] = useState("all");
  const [view, setView] = useState<"detail" | "calendar" | "report">("detail");
  const [actionFilter, setActionFilter] = useState("all");
  const [taskId, setTaskId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [sources, setSources] = useState<ProgressSources>(emptySources);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState("");
  const [storage, setStorage] = useState("");
  const month = date.slice(0, 7);
  const team = scope.teams.includes(teamFilter) ? teamFilter : "all";
  const members = useMemo(() => scope.memberNames.filter((name) => team === "all" || getSalesTeam(name) === team), [scope.memberNames, team]);
  const includeVips = selectedUser.role === "VIPS" && team === "all";
  const tasks = progressTasks(date, includeVips);
  const actionOptions = useMemo(() => Array.from(new Map(monthDates(month).flatMap((day) => progressTasks(day, includeVips)).map((item) => [item.id, item])).values()), [month, includeVips]);
  const action = actionOptions.some((item) => item.id === actionFilter) ? actionFilter : "all";
  const filteredTasks = tasks.filter((item) => action === "all" || item.id === action);
  const task = filteredTasks.find((item) => item.id === taskId) || filteredTasks[0] || tasks[0];
  const hasMatchingTask = filteredTasks.length > 0;

  useEffect(() => {
    const sync = () => setRefresh((value) => value + 1);
    window.addEventListener("month-end-review-changed", sync);
    return () => window.removeEventListener("month-end-review-changed", sync);
  }, []);

  useEffect(() => {
    let previousToday = getLocalDateKey();
    const timer = window.setInterval(() => {
      const today = getLocalDateKey();
      if (today !== previousToday) {
        setToday(today);
        const previous = previousToday;
        setDate((current) => current === previous ? today : current);
        previousToday = today;
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!scope.canViewOperations) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    setLoading(true);
    setError("");
    setSaveError("");
    setRecords([]);
    setSources(emptySources);
    async function get(url: string) {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "데이터를 불러오지 못했습니다.");
      return data;
    }
    async function load() {
      const dates = monthDates(month);
      const results = await Promise.allSettled([
        get(`/api/ops-progress?viewer=${encodeURIComponent(selectedUser.name)}&date=${dates[0]}`),
        get(`/api/ops-progress?viewer=${encodeURIComponent(selectedUser.name)}&date=${dates[dates.length - 1]}`),
        get("/api/month-end-snapshot?latest=1"),
        get("/api/month-end-rma"),
        get("/api/receivables-aging?latest=1"),
        get("/api/receivables-status?latest=1"),
        get("/api/receivables-matching")
      ]);
      if (!active) return;
      const first = results[0];
      const last = results[1];
      if (first.status === "fulfilled" && last.status === "fulfilled" && Array.isArray(first.value.records) && Array.isArray(last.value.records)) {
        setRecords([...first.value.records, ...last.value.records]);
        setStorage(first.value.storage);
      } else {
        const failure = results.slice(0, 2).find((item) => item.status === "rejected");
        setError(failure?.status === "rejected" ? String(failure.reason?.message || failure.reason) : "점검 상태를 불러오지 못했습니다.");
      }
      const snapshot = (index: number) => results[index].status === "fulfilled" ? results[index].value?.snapshot ?? null : null;
      setSources({ closing: snapshot(2), rma: snapshot(3), ar: snapshot(4), collection: snapshot(5), matching: snapshot(6) });
      setLoading(false);
      window.clearTimeout(timeout);
    }
    void load();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [month, selectedUser.name, scope.canViewOperations, refresh]);

  const rows = useMemo(() => (!hasMatchingTask ? [] : task.audience === "vips" ? ["VIPS"] : members).map((name) => {
    const evidence = buildProgressEvidence(sources, task.id, name, date);
    return { name, evidence, ...resolveProgress(records, date, task.id, name, evidence) };
  }).sort((a, b) => Number(a.status === "complete") - Number(b.status === "complete") || a.name.localeCompare(b.name)), [hasMatchingTask, task.id, task.audience, members, sources, records, date]);

  const days = useMemo<CalendarDay[]>(() => monthDates(month).map((day) => {
    let scheduled = progressTasks(day, includeVips).filter((item) => item.id !== "month-end-review");
    if (!scheduled.length && records.some((item) => item.date === day && item.task === "month-end-review" && members.includes(item.subject))) {
      scheduled = progressTasks(day).filter((item) => item.id === "month-end-review");
    }
    if (action === "month-end-review") scheduled = progressTasks(day).filter((item) => item.id === action);
    else if (action !== "all") scheduled = scheduled.filter((item) => item.id === action);
    const salesTasks = scheduled.filter((item) => item.audience === "sales");
    const countedTasks = salesTasks.length ? salesTasks : scheduled;
    const subjects = salesTasks.length ? members : scheduled.length ? ["VIPS"] : [];
    const counts = { complete: 0, in_progress: 0, incomplete: 0, unknown: 0 };
    if (day <= today) subjects.forEach((name) => {
      const statuses = countedTasks.map((item) => resolveProgress(records, day, item.id, name, buildProgressEvidence(sources, item.id, name, day)).status);
      counts[combineTaskStatuses(statuses)] += 1;
    });
    return { date: day, titles: scheduled.map((item) => shortTaskTitle(item.id)), counts, vipsOnly: scheduled.length > 0 && salesTasks.length === 0, memberCount: subjects.length };
  }), [month, includeVips, members, records, sources, today, action]);

  function selectAction(value: string) {
    setActionFilter(value);
    setTaskId(value === "all" ? "" : value);
    if (value !== "all" && !progressTasks(date, includeVips).some((item) => item.id === value)) {
      const target = monthDates(month).find((day) => progressTasks(day, includeVips).some((item) => item.id === value));
      if (target) setDate(target);
    }
  }

  function changeMonth(offset: number) {
    setDate(`${shiftCalendarMonth(month, offset)}-01`);
    setTaskId("");
  }

  async function save(name: string, status: ProgressStatus) {
    const row = rows.find((item) => item.name === name);
    if (!row) return;
    setSaving(name);
    setSaveError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`/api/ops-progress?viewer=${encodeURIComponent(selectedUser.name)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ date, task: task.id, subject: name, status, evidence: row.evidence.pending })
      });
      const data = await response.json();
      if (!response.ok || !data.record) throw new Error(data.message || "저장하지 못했습니다.");
      setRecords((current) => [...current.filter((item) => !(item.date === date && item.task === task.id && item.subject === name)), data.record]);
      setStorage(data.storage);
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : "저장하지 못했습니다."); }
    finally { window.clearTimeout(timeout); setSaving(""); }
  }

  return (
    <section className="min-w-0 bg-white p-4 sm:p-5" aria-busy={loading}>
      <div role="tablist" aria-label="팀 선택" className="mb-4 flex flex-wrap gap-1 border-b border-[#dce6f3]">
        {["all", ...scope.teams].map((value) => <button key={value} type="button" role="tab" aria-selected={team === value} disabled={Boolean(saving)} onClick={() => setTeamFilter(value)} className={`min-h-10 border-b-2 px-4 text-[13px] font-bold ${team === value ? "border-[#1D50A2] text-[#1D50A2]" : "border-transparent text-[#64748b] hover:text-[#1D50A2]"}`}>{value === "all" ? "전체" : value}</button>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5eaf3] pb-4">
        <h2 className="text-[20px] font-black text-[#111827]">운영현황</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="이전 달" title="이전 달" disabled={Boolean(saving)} onClick={() => changeMonth(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg border"><ChevronLeft size={18} /></button>
          <input aria-label="표시 월" type="month" value={month} disabled={Boolean(saving)} onChange={(event) => { if (validProgressDate(`${event.target.value}-01`)) { setDate(`${event.target.value}-01`); setTaskId(""); } }} className="h-9 w-[150px] rounded-lg border px-2 text-[13px] font-bold" />
          <button type="button" aria-label="다음 달" title="다음 달" disabled={Boolean(saving)} onClick={() => changeMonth(1)} className="flex h-9 w-9 items-center justify-center rounded-lg border"><ChevronRight size={18} /></button>
          <button type="button" aria-label="오늘로 이동" title="오늘로 이동" disabled={Boolean(saving)} onClick={() => { setDate(getLocalDateKey()); setTaskId(""); }} className="flex h-9 w-9 items-center justify-center rounded-lg border text-[#1D50A2]"><CalendarDays size={18} /></button>
          <button type="button" title="새로고침" aria-label="점검 새로고침" disabled={loading || Boolean(saving)} onClick={() => setRefresh((value) => value + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border text-[#1D50A2] disabled:opacity-40"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="운영현황 보기" className="flex border-b border-[#dce6f3]">
          {([{ id: "detail", label: "전체 점검 현황" }, { id: "calendar", label: "월간 운영현황" }] as const).map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} disabled={Boolean(saving)} onClick={() => setView(item.id)} className={`min-h-10 border-b-2 px-4 text-[13px] font-bold ${view === item.id ? "border-[#1D50A2] text-[#1D50A2]" : "border-transparent text-[#64748b]"}`}>{item.label}</button>)}
        </div>
        <button type="button" aria-pressed={view === "report"} disabled={Boolean(saving)} onClick={() => setView("report")} className="flex min-h-10 items-center gap-2 px-2 text-[13px] font-bold text-[#1D50A2] aria-pressed:underline"><ChartNoAxesColumn size={17} />Sales 마감 리포트</button>
      </div>
      {view !== "report" ? <select aria-label="ACTION 필터" value={action} disabled={Boolean(saving)} onChange={(event) => selectAction(event.target.value)} className="mt-4 h-10 w-full max-w-[440px] rounded-lg border bg-white px-2 text-[13px]"><option value="all">전체 ACTION</option>{actionOptions.map((item) => <option key={item.id} value={item.id}>{item.scheduleLabel} · {shortTaskTitle(item.id)}</option>)}</select> : null}
      {view === "report" ? loading ? <p role="status" className="py-10 text-center text-[#64748b]">점검 기록을 불러오는 중입니다.</p> : error ? <p role="alert" className="py-6 text-[#b91c1c]">{error}</p> : <OpsClosingReport records={records} month={month} members={members} today={today} onSelect={(value, id) => { setDate(value); setTaskId(id); setActionFilter(id); setView("detail"); }} /> : view === "calendar" ? <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 py-3 text-[12px]">
        {calendarStatuses.map((status) => <span key={status} className={`flex items-center gap-1.5 ${statusColors[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabels[status]}</span>)}
      </div>
      <OpsProgressCalendar days={days} selectedDate={date} today={today} loading={loading} failed={Boolean(error)} disabled={Boolean(saving)} onSelect={(value) => { setDate(value); setTaskId(""); setView("detail"); }} />
      {error ? <p role="alert" className="mt-4 text-[13px] text-[#b91c1c]">{error}</p> : null}
      </> : <>
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[18px] font-black">{Number(date.slice(5, 7))}월 {Number(date.slice(8))}일 · {team === "all" ? "전체" : team} 점검 현황</h3>
          <input aria-label="점검일" type="date" value={date} disabled={Boolean(saving)} onChange={(event) => { if (validProgressDate(event.target.value)) { setDate(event.target.value); setTaskId(""); } }} className="h-9 max-w-full rounded-lg border px-2 text-[13px]" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <select aria-label="점검 일정" value={hasMatchingTask ? task.id : ""} disabled={Boolean(saving) || !hasMatchingTask} onChange={(event) => setTaskId(event.target.value)} className="h-10 w-full max-w-[620px] rounded-lg border bg-white px-2 text-[13px] font-bold">
          {!hasMatchingTask ? <option value="">해당 날짜에 선택한 ACTION이 없습니다.</option> : filteredTasks.map((item) => <option key={item.id} value={item.id}>{item.scheduleLabel} · {item.title}</option>)}
        </select>
        <span className="text-[12px] text-[#64748b]">마감 대상 {progressCycle(date)}{storage === "local" ? " · 미리보기 저장소" : ""}</span>
      </div>
      {date > today ? <p className="mb-4 text-[13px] text-[#64748b]">예정된 점검입니다.</p> : !loading && !error ? <p className="mb-4 flex flex-wrap gap-4 text-[13px] font-bold">{calendarStatuses.map((status) => <span key={status} className={statusColors[status]}>{statusLabels[status]} {rows.filter((row) => row.status === status).length}{task.audience === "vips" ? "건" : "명"}</span>)}</p> : null}
      {error || saveError ? <p role="alert" className="mb-4 text-[13px] text-[#b91c1c]">{error || saveError}</p> : null}
      {!loading && !error && rows.length === 0 ? <p role="status" className="py-6 text-center text-[13px] text-[#64748b]">{hasMatchingTask ? "등록된 팀원이 없습니다." : "선택한 ACTION의 점검일을 선택해주세요."}</p> : null}
      {loading ? <p role="status" className="py-10 text-center text-[#64748b]">점검 현황을 불러오는 중입니다.</p> : error ? null : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[13px]">
            <thead className="border-y bg-[#f8fbff] text-[#64748b]"><tr><th className="p-3">Sales</th><th className="p-3">팀</th><th className="p-3">점검 상태</th><th className="p-3">확인 내역</th><th className="p-3">수동 지정</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.name} className="border-b border-[#edf1f7]">
              <th scope="row" className="p-3">{row.name}</th><td className="p-3">{getSalesTeam(row.name, "-")}</td>
              <td className="p-3"><strong className={date > today ? "text-[#64748b]" : statusColors[row.status as CalendarStatus]}>{date > today ? "예정" : statusLabels[row.status as CalendarStatus]}</strong>{date <= today && row.source !== "확인 필요" ? <div className="mt-1 text-[11px] text-[#64748b]">{row.source}{row.record ? ` · ${row.record.updatedBy}` : ""}</div> : null}</td>
              <td className="max-w-[260px] break-words p-3 text-[#64748b]">{date > today ? "-" : row.evidence.missing.length ? row.evidence.missing.join(" · ") : `남은 확인 ${row.evidence.pending.length}건`}</td>
              <td className="p-3"><div className="flex gap-1" role="group" aria-label={`${row.name} 상태 지정`}>
                {([{ status: "complete", label: "완료", Icon: CheckCircle2 }, { status: "in_progress", label: "진행 중", Icon: Clock3 }, { status: "incomplete", label: "미완료", Icon: CircleX }, { status: "auto", label: "자동 판단으로 되돌리기", Icon: RotateCcw }] as const).map(({ status, label, Icon }) => <button key={status} type="button" aria-label={`${row.name} ${label}`} title={label} disabled={Boolean(saving) || date > today} aria-pressed={Boolean(row.record?.date === date && row.record.task === task.id && row.record.status === status)} onClick={() => void save(row.name, status)} className="flex h-9 w-9 items-center justify-center rounded-lg border text-[#1D50A2] hover:bg-[#edf4ff] aria-pressed:bg-[#edf4ff] disabled:opacity-40"><Icon size={18} /></button>)}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      </>}
    </section>
  );
}
