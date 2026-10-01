import { calendarStatuses, statusColors, statusLabels, type CalendarStatus } from "../services/opsCalendar";

export type CalendarDay = {
  date: string;
  titles: string[];
  counts: Record<CalendarStatus, number>;
  vipsOnly: boolean;
  memberCount: number;
};

export function OpsProgressCalendar({ days, selectedDate, today, loading, failed, disabled, onSelect }: {
  days: CalendarDay[]; selectedDate: string; today: string; loading: boolean; failed: boolean; disabled: boolean; onSelect: (date: string) => void;
}) {
  const offset = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const trailing = (7 - (offset + days.length) % 7) % 7;
  return (
    <div className="overflow-x-auto" aria-label="월간 운영 달력">
      <div className="min-w-[630px] border-l border-t border-[#dce6f3]">
        <div className="grid grid-cols-7 bg-[#f8fbff]">
          {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => <div key={day} className={`border-b border-r border-[#dce6f3] py-2 text-center text-[12px] font-bold ${index === 0 ? "text-[#b91c1c]" : index === 6 ? "text-[#1D50A2]" : "text-[#64748b]"}`}>{day}</div>)}
        </div>
        <div className="grid auto-rows-[132px] grid-cols-7">
          {Array.from({ length: offset }, (_, index) => <div key={`before-${index}`} className="border-b border-r border-[#dce6f3] bg-[#fafbfc]" />)}
          {days.map((day) => {
            const selected = day.date === selectedDate;
            const scheduled = day.date > today;
            const active = day.titles.length > 0;
            return <button key={day.date} type="button" disabled={disabled} aria-pressed={selected} aria-label={`${day.date} ${day.titles.join(" · ") || "일정 없음"}`} onClick={() => onSelect(day.date)} className={`min-w-0 border-b border-r border-[#dce6f3] p-1.5 text-left align-top transition hover:bg-[#f0f6ff] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D50A2] ${selected ? "bg-[#edf4ff] shadow-[inset_0_0_0_2px_#1D50A2]" : "bg-white"}`}>
              <div className="flex h-full min-w-0 flex-col">
                <div className="mb-1 flex items-center gap-1">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${day.date === today ? "bg-[#1D50A2] text-white" : "text-[#334155]"}`}>{Number(day.date.slice(8))}</span>
                  {day.date === today ? <span className="text-[10px] font-bold text-[#1D50A2]">오늘</span> : null}
                </div>
                {active ? <>
                  <span className="mb-1 truncate text-[11px] font-bold leading-4 text-[#10203f]" title={day.titles.join(" · ")}>{day.titles[0]}{day.titles.length > 1 ? ` 외 ${day.titles.length - 1}건` : ""}</span>
                  {scheduled ? <span className="text-[11px] text-[#64748b]">예정</span> : loading ? <span className="text-[11px] text-[#64748b]">불러오는 중</span> : failed ? <span className="text-[11px] text-[#b91c1c]">조회 실패</span> : day.memberCount === 0 ? <span className="text-[11px] text-[#64748b]">팀원 미등록</span> : <div className="space-y-0.5">
                    {calendarStatuses.map((status) => <div key={status} className={`flex justify-between gap-1 text-[11px] leading-[14px] ${statusColors[status]}`}><span>{statusLabels[status]}</span><strong className="tabular-nums">{day.counts[status]}</strong></div>)}
                  </div>}
                </> : null}
              </div>
            </button>;
          })}
          {Array.from({ length: trailing }, (_, index) => <div key={`after-${index}`} className="border-b border-r border-[#dce6f3] bg-[#fafbfc]" />)}
        </div>
      </div>
    </div>
  );
}
