import { getLocalDateKey } from "./opsActionSchedule";
import { monthDates } from "./opsCalendar";
import { progressCycle, progressTasks, type ProgressRecord } from "./opsProgress";

const stageIds = ["closing-d7-first-cleanup", "closing-d4-second-cleanup", "closing-d1-third-check", "closing-dday-final-check"];

export function closingStages(month: string) {
  return monthDates(month).flatMap((date) => progressTasks(date).filter((task) => stageIds.includes(task.id)).map((task) => ({
    id: task.id, date, label: ["1차", "2차", "3차", "최종"][stageIds.indexOf(task.id)]
  })));
}

export function buildClosingReport(records: ProgressRecord[], month: string, members: string[], today: string) {
  const stages = closingStages(month);
  const cycle = progressCycle(`${month}-10`);
  return members.map((name) => {
    const checks = stages.map((stage) => {
      const record = stage.date <= today ? records.filter((item) => item.cycle === cycle && item.subject === name && item.task === stage.id && item.date === stage.date)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] : undefined;
      const recordedDate = record && Number.isFinite(Date.parse(record.updatedAt)) ? getLocalDateKey(new Date(record.updatedAt)) : "";
      return { ...stage, record, lateEntry: Boolean(recordedDate && recordedDate > stage.date) };
    });
    // Only dated, saved checks can establish a historical completion stage.
    // Today's automatic result must never be projected into an earlier stage.
    const first = checks.find((check) => check.record?.status === "complete");
    const latest = [...checks].reverse().find((check) => check.record);
    const reopened = Boolean(first && latest && latest.date > first.date && ["incomplete", "in_progress"].includes(latest.record!.status));
    const reset = Boolean(first && latest && latest.date > first.date && latest.record!.status === "auto");
    const result = reopened ? "재확인 필요" : reset ? "자동 재판정 대기" : first ? `${first.label} 완료 기록` : latest?.record?.status === "incomplete" ? "미완료" : latest?.record?.status === "in_progress" ? "진행 중" : "평가 대기";
    return { name, checks, first, latest, reopened, result };
  });
}
