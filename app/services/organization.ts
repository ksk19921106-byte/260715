export const SALES_TEAMS = ["B2D", "B2M", "B2SU", "S1", "S2", "S3"] as const;

export type SalesTeam = (typeof SALES_TEAMS)[number];
export type OperationsScopeLevel = "vips" | "teamLeader" | "cellLeader" | "sales";
export type SalesPosition = "셀장" | "팀장" | "Sales";

export type SalesStaff = {
  team: SalesTeam;
  name: string;
  koreanName: string;
  position: SalesPosition;
};

// 2026-09-03 Sales 인원 정보 기준. 조직/로그인/필터가 모두 이 명단을 사용합니다.
export const SALES_STAFF: readonly SalesStaff[] = [
  { team: "B2D", name: "Abel", koreanName: "유재원", position: "Sales" },
  { team: "B2M", name: "Ace", koreanName: "김문수", position: "Sales" },
  { team: "S2", name: "Chris", koreanName: "김희찬", position: "Sales" },
  { team: "B2M", name: "Dan", koreanName: "강형원", position: "Sales" },
  { team: "B2M", name: "Donnie", koreanName: "정현도", position: "Sales" },
  { team: "B2D", name: "Eric", koreanName: "박성현", position: "Sales" },
  { team: "B2D", name: "Harvey", koreanName: "배석진", position: "Sales" },
  { team: "B2M", name: "Heath", koreanName: "정희헌", position: "Sales" },
  { team: "B2M", name: "Jacob", koreanName: "이성민", position: "Sales" },
  { team: "S2", name: "Jenny", koreanName: "박유빈", position: "Sales" },
  { team: "B2M", name: "Joel", koreanName: "강우진", position: "Sales" },
  { team: "S2", name: "Junny", koreanName: "이주은", position: "Sales" },
  { team: "B2SU", name: "Kelvin", koreanName: "김학원", position: "Sales" },
  { team: "B2D", name: "Lauren", koreanName: "박승아", position: "셀장" },
  { team: "S2", name: "Leo", koreanName: "김유빈", position: "Sales" },
  { team: "B2M", name: "Max", koreanName: "조명재", position: "Sales" },
  { team: "B2M", name: "Mona", koreanName: "이소연", position: "Sales" },
  { team: "B2D", name: "Morgan", koreanName: "박영진", position: "Sales" },
  { team: "B2SU", name: "Oscar", koreanName: "유은상", position: "셀장" },
  { team: "S3", name: "Owen", koreanName: "신영욱", position: "Sales" },
  { team: "B2D", name: "Riley", koreanName: "박영근", position: "Sales" },
  { team: "S3", name: "Robin", koreanName: "김의빈", position: "셀장" },
  { team: "B2M", name: "Roger", koreanName: "함승영", position: "Sales" },
  { team: "B2M", name: "Sean", koreanName: "황광석", position: "Sales" },
  { team: "S2", name: "Sonny", koreanName: "박재은", position: "셀장" },
  { team: "S3", name: "Stacey", koreanName: "박소현", position: "Sales" },
  { team: "S3", name: "Sunny", koreanName: "김수진", position: "Sales" },
  { team: "B2D", name: "Swan", koreanName: "조선화", position: "Sales" },
  { team: "S2", name: "Teo", koreanName: "유정민", position: "Sales" },
  { team: "B2M", name: "Terry", koreanName: "금우정", position: "Sales" },
  { team: "B2M", name: "Victor", koreanName: "김화영", position: "Sales" },
  { team: "B2SU", name: "Winnie", koreanName: "이시현", position: "Sales" },
  { team: "S3", name: "Yena", koreanName: "이채연", position: "Sales" },
  { team: "B2M", name: "Zeff", koreanName: "임지수", position: "셀장" },
  { team: "B2D", name: "Zeke", koreanName: "김상우", position: "Sales" }
];

export type OperationsUser = {
  name: string;
  salesName: string;
  team: string;
  role: "SALES" | "VIPS";
  accessRole: "admin" | "manager" | "sales";
};

export type OperationsScope = {
  level: OperationsScopeLevel;
  label: string;
  teams: string[];
  memberNames: string[];
  canViewOperations: boolean;
  canManageGatekeeper: boolean;
};

export const SALES_LEADERS = [
  { name: "Tommy", level: "teamLeader" as const, teams: ["B2D", "B2M", "B2SU", "S1"] as SalesTeam[], label: "Sales 팀장" },
  { name: "William", level: "teamLeader" as const, teams: ["S2", "S3"] as SalesTeam[], label: "Sales 팀장" },
  { name: "Robin", level: "cellLeader" as const, teams: ["S3"] as SalesTeam[], label: "S3 셀장" },
  { name: "Sonny", level: "cellLeader" as const, teams: ["S2"] as SalesTeam[], label: "S2 셀장" },
  { name: "Lauren", level: "cellLeader" as const, teams: ["B2D"] as SalesTeam[], label: "B2D 셀장" },
  { name: "Zeff", level: "cellLeader" as const, teams: ["B2M"] as SalesTeam[], label: "B2M 셀장" },
  { name: "Oscar", level: "cellLeader" as const, teams: ["B2SU"] as SalesTeam[], label: "B2SU 셀장" }
] as const;

const TEAM_MEMBERS = Object.fromEntries(
  SALES_TEAMS.map((team) => [team, SALES_STAFF.filter((person) => person.team === team).map((person) => person.name)])
) as Record<SalesTeam, string[]>;

const LEADERSHIP = Object.fromEntries(SALES_LEADERS.map((leader) => [leader.name.toLowerCase(), leader]));

function key(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getAllSalesNames() {
  return unique([...SALES_STAFF.map((person) => person.name), ...SALES_LEADERS.map((leader) => leader.name)]);
}

export function getSalesStaff(name: string) {
  const target = key(name);
  return SALES_STAFF.find((person) => key(person.name) === target);
}

export function isSalesOperationsLeader(name: string) {
  return Boolean(LEADERSHIP[key(name)]);
}

export function getSalesTeam(name: string, fallback = "") {
  const person = getSalesStaff(name);
  return person?.team ?? fallback;
}

export function getTeamMembers(team: string) {
  return SALES_TEAMS.includes(team as SalesTeam) ? [...TEAM_MEMBERS[team as SalesTeam]] : [];
}

export function getOperationsScope(user: OperationsUser): OperationsScope {
  if (user.role === "VIPS" || user.team === "VIPS팀") {
    return {
      level: "vips",
      label: "VIPS 전체 운영",
      teams: [...SALES_TEAMS],
      memberNames: getAllSalesNames(),
      canViewOperations: true,
      canManageGatekeeper: true
    };
  }

  const leadership = LEADERSHIP[key(user.name)] ?? LEADERSHIP[key(user.salesName)];
  if (leadership) {
    return {
      level: leadership.level,
      label: `${leadership.label} (${leadership.teams.join(" · ")})`,
      teams: [...leadership.teams],
      memberNames: unique([user.salesName, ...leadership.teams.flatMap((team) => TEAM_MEMBERS[team])]),
      canViewOperations: true,
      canManageGatekeeper: false
    };
  }

  const team = getSalesTeam(user.salesName, user.team);
  if (user.role === "SALES" && user.accessRole === "manager") {
    const managerTeams = team ? [team] : [];
    return {
      level: "teamLeader",
      label: team ? `${team} 운영 리포트` : "Sales 운영 리포트",
      teams: managerTeams,
      memberNames: unique([user.salesName, ...managerTeams.flatMap((item) => getTeamMembers(item))]),
      canViewOperations: true,
      canManageGatekeeper: false
    };
  }

  return {
    level: "sales",
    label: "개인 Sales",
    teams: team ? [team] : [],
    memberNames: [user.salesName],
    canViewOperations: false,
    canManageGatekeeper: false
  };
}

export function isSalesNameInScope(name: string, scope: OperationsScope) {
  const target = key(name);
  return scope.memberNames.some((member) => key(member) === target);
}

export function isTeamInScope(team: string, scope: OperationsScope) {
  return scope.teams.some((item) => key(item) === key(team));
}

export function canAccessSalesOperations(user: OperationsUser) {
  return user.role === "SALES" && (user.accessRole === "manager" || getOperationsScope(user).canViewOperations);
}

export function monthEndCompletion(issues: Array<{ memo?: string; status?: string }>) {
  const activeIssues = issues.filter((issue) => issue.status !== "done" && issue.status !== "dismissed");
  const missingReasonCount = activeIssues.filter((issue) => !String(issue.memo ?? "").trim()).length;
  return {
    complete: activeIssues.length === 0 || missingReasonCount === 0,
    issueCount: activeIssues.length,
    missingReasonCount
  };
}
