export const calendarStatuses = ["complete", "in_progress", "incomplete", "unknown"] as const;
export type CalendarStatus = typeof calendarStatuses[number];
export const statusLabels: Record<CalendarStatus, string> = { complete: "완료", in_progress: "진행 중", incomplete: "미완료", unknown: "확인 필요" };
export const statusColors: Record<CalendarStatus, string> = { complete: "text-[#15803d]", in_progress: "text-[#1D50A2]", incomplete: "text-[#b45309]", unknown: "text-[#64748b]" };

export function monthDates(month: string) {
  const [year, number] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

export function shiftCalendarMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function combineTaskStatuses(statuses: string[]): CalendarStatus {
  if (!statuses.length || statuses.includes("unknown")) return "unknown";
  if (statuses.every((status) => status === "complete")) return "complete";
  if (statuses.includes("in_progress") || statuses.includes("complete")) return "in_progress";
  return "incomplete";
}

export function shortTaskTitle(id: string) {
  return ({
    "closing-d7-first-cleanup": "1차 마감 점검",
    "closing-d4-second-cleanup": "2차 마감 점검",
    "closing-d1-third-check": "3차 마감 점검",
    "closing-dday-final-check": "최종 마감 점검",
    "month-end-d3-unshipped": "월말 미출고 점검",
    "month-end-dday-unshipped-collection": "월말 미출고·수금",
    "closing-d7-duplicate-sales": "이중매출 점검",
    "closing-dday-tax-billing": "Tax·Billing 비교",
    "closing-d1-report": "월마감 리포트",
    "month-end-review": "월마감 확인"
  } as Record<string, string>)[id] || "월마감 점검";
}
