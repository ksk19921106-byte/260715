import { SALES_LEADERS, SALES_STAFF, getSalesTeam, isSalesOperationsLeader } from "./organization";

export type PortalUserName = string;
export type PortalUserRole = "SALES" | "VIPS";
export type PortalAccessRole = "admin" | "manager" | "sales";

export type PortalUser = {
  name: PortalUserName;
  email: string;
  team: string;
  role: PortalUserRole;
  accessRole: PortalAccessRole;
  salesName: string;
  koreanName?: string;
};

const VIPS_USERS: PortalUser[] = [
  { name: "Sally", email: "sally@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Sally" },
  { name: "Vincent", email: "vincent@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Vincent" },
  { name: "Gavin", email: "gavin@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Gavin" }
];

const salesUsers: PortalUser[] = SALES_STAFF.map((person) => ({
  name: person.name,
  email: `${person.name.toLowerCase()}@icbanq.com`,
  team: person.team,
  role: "SALES",
  accessRole: isSalesOperationsLeader(person.name) ? "manager" : "sales",
  salesName: person.name,
  koreanName: person.koreanName
}));

const organizationLeaderUsers: PortalUser[] = SALES_LEADERS.filter(
  (leader) => !SALES_STAFF.some((person) => person.name.toLowerCase() === leader.name.toLowerCase())
).map((leader) => ({
  name: leader.name,
  email: `${leader.name.toLowerCase()}@icbanq.com`,
  team: getSalesTeam(leader.name, "Sales본부"),
  role: "SALES",
  accessRole: "manager",
  salesName: leader.name
}));

export const PORTAL_USERS: PortalUser[] = [...VIPS_USERS, ...organizationLeaderUsers, ...salesUsers];

function key(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function getPortalUserByName(name: string | null | undefined) {
  const target = key(name);
  return PORTAL_USERS.find((user) => key(user.name) === target || key(user.salesName) === target) ?? null;
}

export function getPortalUserByEmail(email: string | null | undefined) {
  const target = key(email);
  return PORTAL_USERS.find((user) => key(user.email) === target) ?? null;
}

