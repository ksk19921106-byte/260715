import { SALES_LEADERS } from "./organization";

export type OpsActionMode = "action" | "check";
export type OpsActionTone = "danger" | "warning" | "primary";

export type OpsActionItem = {
  id: string;
  title: string;
  description: string;
  scheduleLabel: string;
  mode: OpsActionMode;
  tone: OpsActionTone;
  route: string;
};

type CheckerGroup = "vips" | "teamLeader" | "cellLeader" | "gavin";

type ActionRule = {
  id: string;
  when: (date: Date) => boolean;
  scheduleLabel: string;
  actionTitle: string;
  checkTitle: string;
  actionDescription: string;
  checkDescription: string;
  checkers: CheckerGroup[];
  audience: "sales" | "none";
  tone: OpsActionTone;
  route: string;
};

const VIPS_NAMES = new Set(["sally", "gavin", "vincent"]);
const TEAM_LEADER_NAMES = new Set(
  SALES_LEADERS.filter((leader) => leader.level === "teamLeader").map((leader) => leader.name.toLowerCase())
);
const CELL_LEADER_NAMES = new Set(
  SALES_LEADERS.filter((leader) => leader.level === "cellLeader").map((leader) => leader.name.toLowerCase())
);

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function getKoreaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day")
  };
}

function lastDayOfMonth(date: Date) {
  const { year, month } = getKoreaDateParts(date);
  return new Date(year, month, 0).getDate();
}

function isMonthEndOffset(date: Date, offset: number) {
  return getKoreaDateParts(date).day === lastDayOfMonth(date) + offset;
}

function isClosingDayOffset(date: Date, offset: number) {
  return getKoreaDateParts(date).day === 10 + offset;
}

function getRoles(userName: string) {
  const name = normalizeName(userName);
  return {
    isVips: VIPS_NAMES.has(name),
    isTeamLeader: TEAM_LEADER_NAMES.has(name),
    isCellLeader: CELL_LEADER_NAMES.has(name),
    isGavin: name === "gavin"
  };
}

function isChecker(checkers: CheckerGroup[], roles: ReturnType<typeof getRoles>) {
  return checkers.some((group) => {
    if (group === "vips") return roles.isVips;
    if (group === "teamLeader") return roles.isTeamLeader;
    if (group === "cellLeader") return roles.isCellLeader;
    return roles.isGavin;
  });
}

const ACTION_RULES: ActionRule[] = [
  {
    id: "month-end-d3-unshipped",
    when: (date) => isMonthEndOffset(date, -3),
    scheduleLabel: "월말 D-3",
    actionTitle: "입고 O / 미출고 X 점검",
    checkTitle: "담당 조직 입고 O / 미출고 X 점검",
    actionDescription: "월말 전에 입고되었지만 아직 출고되지 않은 거래를 정리하세요.",
    checkDescription: "담당 Sales의 입고 완료·미출고 거래가 빠짐없이 정리되고 있는지 점검하세요.",
    checkers: ["vips", "teamLeader"],
    audience: "sales",
    tone: "warning",
    route: "/month-end"
  },
  {
    id: "month-end-dday-unshipped-collection",
    when: (date) => isMonthEndOffset(date, 0),
    scheduleLabel: "월말 D-Day",
    actionTitle: "입고 O / 미출고 X 점검 · 월말 수금",
    checkTitle: "담당 조직 미출고 거래·월말 수금 점검",
    actionDescription: "월말 기준 미출고 거래와 당일 수금 내역을 최종 확인하세요.",
    checkDescription: "담당 Sales의 미출고 거래와 월말 수금 내역이 정리되었는지 최종 점검하세요.",
    checkers: ["vips", "teamLeader"],
    audience: "sales",
    tone: "danger",
    route: "/month-end"
  },
  {
    id: "closing-d7-first-cleanup",
    when: (date) => isClosingDayOffset(date, -7),
    scheduleLabel: "마감일 D-7",
    actionTitle: "AR·RMA·수금 미매칭·월마감 미처리 정리 (1차)",
    checkTitle: "담당 조직 마감 항목 1차 점검",
    actionDescription: "AR, RMA, 수금 미매칭과 월마감 미처리 건을 1차로 정리하세요.",
    checkDescription: "담당 조직의 AR, RMA, 수금 미매칭, 월마감 미처리 내역을 1차 점검하세요.",
    checkers: ["teamLeader", "cellLeader"],
    audience: "sales",
    tone: "warning",
    route: "/month-end"
  },
  {
    id: "closing-d7-duplicate-sales",
    when: (date) => isClosingDayOffset(date, -7),
    scheduleLabel: "마감일 D-7",
    actionTitle: "이중매출 확인",
    checkTitle: "전사 이중매출 점검",
    actionDescription: "이중매출 의심 건을 확인하세요.",
    checkDescription: "전사 이중매출 의심 건이 있는지 1차 점검하세요.",
    checkers: ["vips"],
    audience: "none",
    tone: "danger",
    route: "/vips-ops"
  },
  {
    id: "closing-d4-second-cleanup",
    when: (date) => isClosingDayOffset(date, -4),
    scheduleLabel: "마감일 D-4",
    actionTitle: "AR·RMA·수금 미매칭·월마감 미처리 정리 (2차)",
    checkTitle: "담당 조직 마감 항목 2차 점검",
    actionDescription: "남아 있는 AR, RMA, 수금 미매칭과 월마감 미처리 건을 다시 정리하세요.",
    checkDescription: "담당 조직의 미처리 내역이 줄고 있는지 2차 점검하세요.",
    checkers: ["teamLeader", "cellLeader"],
    audience: "sales",
    tone: "warning",
    route: "/month-end"
  },
  {
    id: "closing-d1-third-check",
    when: (date) => isClosingDayOffset(date, -1),
    scheduleLabel: "마감일 D-1",
    actionTitle: "AR·RMA·수금 미매칭·월마감 미처리 내역 점검 (3차)",
    checkTitle: "담당 조직 마감 항목 3차 점검",
    actionDescription: "마감 전날 남은 AR, RMA, 수금 미매칭과 월마감 미처리 내역을 점검하세요.",
    checkDescription: "담당 조직에 마감 전날까지 남은 미처리 내역이 있는지 3차 점검하세요.",
    checkers: ["vips", "teamLeader", "cellLeader"],
    audience: "sales",
    tone: "danger",
    route: "/month-end"
  },
  {
    id: "closing-dday-final-check",
    when: (date) => isClosingDayOffset(date, 0),
    scheduleLabel: "마감일 D-Day",
    actionTitle: "AR·RMA·수금 미매칭·월마감 최종 점검",
    checkTitle: "담당 조직 월마감 최종 점검",
    actionDescription: "AR, RMA, 수금 미매칭과 월마감 내역을 최종 확인하세요.",
    checkDescription: "담당 Sales의 AR, RMA, 수금 미매칭과 월마감이 모두 정리되었는지 최종 점검하세요.",
    checkers: ["vips", "teamLeader"],
    audience: "sales",
    tone: "danger",
    route: "/month-end"
  },
  {
    id: "closing-dday-tax-billing",
    when: (date) => isClosingDayOffset(date, 0),
    scheduleLabel: "마감일 D-Day",
    actionTitle: "이중매출·Tax vs Billing 비교",
    checkTitle: "전사 이중매출·Tax vs Billing 비교 점검",
    actionDescription: "이중매출과 Tax·Billing 차이를 비교하세요.",
    checkDescription: "전사 이중매출 여부와 Tax·Billing 차이를 최종 비교 점검하세요.",
    checkers: ["vips"],
    audience: "none",
    tone: "danger",
    route: "/vips-ops"
  },
  {
    id: "closing-d1-report",
    when: (date) => isClosingDayOffset(date, 1),
    scheduleLabel: "마감일 D+1",
    actionTitle: "월마감 레포트 작성",
    checkTitle: "월마감 레포트 작성·점검",
    actionDescription: "실적, 마감현황, Tax vs Billing, RMA를 월마감 레포트로 정리하세요.",
    checkDescription: "실적, 마감현황, Tax vs Billing, RMA를 월마감 레포트로 작성하고 점검하세요.",
    checkers: ["gavin"],
    audience: "none",
    tone: "primary",
    route: "/vips-ops"
  }
];

export function getTodayOpsActions(userName: string, date = new Date()): OpsActionItem[] {
  const roles = getRoles(userName);
  const isRegularSales = !roles.isVips;

  return ACTION_RULES.filter((rule) => rule.when(date))
    .map((rule): OpsActionItem | null => {
      const checker = isChecker(rule.checkers, roles);
      if (!checker && !(rule.audience === "sales" && isRegularSales)) return null;

      return {
        id: rule.id,
        title: checker ? rule.checkTitle : rule.actionTitle,
        description: checker ? rule.checkDescription : rule.actionDescription,
        scheduleLabel: rule.scheduleLabel,
        mode: checker ? "check" : "action",
        tone: rule.tone,
        route: rule.route
      };
    })
    .filter((item): item is OpsActionItem => item !== null);
}

export function getLocalDateKey(date = new Date()) {
  const { year, month: monthNumber, day: dayNumber } = getKoreaDateParts(date);
  const month = String(monthNumber).padStart(2, "0");
  const day = String(dayNumber).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
