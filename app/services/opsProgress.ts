import { getScheduledTrackingActions } from "./opsActionSchedule";

export type ProgressStatus = "complete" | "in_progress" | "incomplete" | "auto";
export type ProgressRecord = {
  cycle: string;
  date: string;
  task: string;
  subject: string;
  status: ProgressStatus;
  evidence: string[];
  updatedBy: string;
  updatedAt: string;
};
export type ProgressTask = { id: string; title: string; scheduleLabel: string; audience: "sales" | "vips" };
export type ProgressEvidence = { known: boolean; pending: string[]; missing: string[]; total?: number };

export function validProgressDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}

export function progressTasks(date: string, includeVips = false): ProgressTask[] {
  const scheduled = getScheduledTrackingActions(new Date(`${date}T12:00:00+09:00`));
  return [
    ...scheduled.filter((item) => includeVips || item.audience === "sales"),
    { id: "month-end-review", title: "월마감 확인", scheduleLabel: "전체", audience: "sales" as const }
  ];
}

export function progressCycle(date: string) {
  const value = new Date(`${date}T12:00:00+09:00`);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  // The 1st-11th closing actions belong to the preceding month's close.
  return Number(date.slice(8)) <= 11
    ? new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
    : value.toISOString().slice(0, 7);
}

function cleanupTask(task: string) {
  return ["closing-d7-first-cleanup", "closing-d4-second-cleanup", "closing-d1-third-check", "closing-dday-final-check"].includes(task);
}

export function resolveProgress(records: ProgressRecord[], date: string, task: string, subject: string, evidence: ProgressEvidence) {
  const cycle = progressCycle(date);
  const history = records.filter((item) => item.cycle === cycle && item.subject === subject && item.date <= date);
  const current = history.find((item) => item.date === date && item.task === task);
  if (current && current.status !== "auto") return { status: current.status, source: "수동", record: current };
  if (evidence.known && evidence.pending.length === 0) return { status: "complete", source: "자동", record: undefined };
  // An explicit reset to automatic must not restore an older manual completion.
  if (!current && evidence.known) {
    const previous = history.filter((item) => item.date < date && (item.task === task || (cleanupTask(task) && cleanupTask(item.task))))
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
    if (previous?.status === "complete" && evidence.pending.every((key) => previous.evidence.includes(key))) {
      return { status: "complete", source: "이전 차수 완료", record: previous };
    }
  }
  const automaticStatus = evidence.known
    ? (evidence.total ?? evidence.pending.length) > evidence.pending.length ? "in_progress" : "incomplete"
    : "unknown";
  return { status: automaticStatus, source: evidence.known ? "자동" : "확인 필요", record: undefined };
}
