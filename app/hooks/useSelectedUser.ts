"use client";

import { useEffect, useState } from "react";
import { SALES_LEADERS, SALES_STAFF, getSalesTeam, isSalesOperationsLeader } from "../services/organization";
import { getOpsAuthMode } from "../services/authMode";

export type TestUserName = string;
export type UserRole = "SALES" | "VIPS";
export type AccessRole = "admin" | "manager" | "sales";

export type TestUser = {
  name: TestUserName;
  email: string;
  team: string;
  role: UserRole;
  accessRole: AccessRole;
  salesName: string;
  koreanName?: string;
};

const VIPS_USERS: TestUser[] = [
  { name: "Sally", email: "sally@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Sally" },
  { name: "Vincent", email: "vincent@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Vincent" },
  { name: "Gavin", email: "gavin@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Gavin" }
];

const salesUsers: TestUser[] = SALES_STAFF.map((person) => ({
  name: person.name,
  email: `${person.name.toLowerCase()}@icbanq.com`,
  team: person.team,
  role: "SALES",
  accessRole: isSalesOperationsLeader(person.name) ? "manager" : "sales",
  salesName: person.name,
  koreanName: person.koreanName
}));

const organizationLeaderUsers: TestUser[] = SALES_LEADERS.filter(
  (leader) => !SALES_STAFF.some((person) => person.name.toLowerCase() === leader.name.toLowerCase())
).map((leader) => ({
  name: leader.name,
  email: `${leader.name.toLowerCase()}@icbanq.com`,
  team: getSalesTeam(leader.name, "Sales본부"),
  role: "SALES",
  accessRole: "manager",
  salesName: leader.name
}));

export const TEST_USERS: TestUser[] = [...VIPS_USERS, ...organizationLeaderUsers, ...salesUsers];

const STORAGE_KEY = "icbanq.ops.selectedUser";
const EVENT_NAME = "icbanq:selected-user-change";
const AUTH_MODE = getOpsAuthMode();

function normalizeUser(value: string | null): TestUserName {
  const matched = TEST_USERS.find((user) => user.name.toLowerCase() === String(value || "").toLowerCase());
  return matched ? matched.name : "Sally";
}

function readStoredUser() {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredUser(name: TestUserName) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, name);
  } catch {
    // URL state still keeps login switching working.
  }
}

export function getTestUser(name: string | null) {
  const normalized = normalizeUser(name);
  return TEST_USERS.find((user) => user.name === normalized) ?? TEST_USERS[0];
}

export function useSelectedUser() {
  const [selectedUser, setSelectedUserState] = useState<TestUser>(TEST_USERS[0]);
  const [isAuthLoading, setIsAuthLoading] = useState(AUTH_MODE === "supabase");
  const [isAuthenticated, setIsAuthenticated] = useState(AUTH_MODE !== "supabase");

  useEffect(() => {
    if (AUTH_MODE === "supabase") {
      let active = true;

      const loadSessionUser = async () => {
        try {
          const response = await fetch("/api/auth/me", { cache: "no-store" });
          if (!response.ok) {
            window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
            return;
          }

          const payload = (await response.json()) as { user?: TestUser };
          if (active && payload.user) {
            setSelectedUserState(payload.user);
            setIsAuthenticated(true);
          }
        } catch {
          if (active) setIsAuthenticated(false);
        } finally {
          if (active) setIsAuthLoading(false);
        }
      };

      void loadSessionUser();
      return () => {
        active = false;
      };
    }

    const sync = () => {
      if (typeof window === "undefined") return;
      const userFromUrl = new URLSearchParams(window.location.search).get("user");
      const normalizedUrlUser = normalizeUser(userFromUrl);
      if (userFromUrl && TEST_USERS.some((user) => user.name.toLowerCase() === userFromUrl.toLowerCase())) {
        writeStoredUser(normalizedUrlUser);
        setSelectedUserState(getTestUser(normalizedUrlUser));
        return;
      }

      setSelectedUserState(getTestUser(readStoredUser()));
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("popstate", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const setSelectedUser = (name: TestUserName) => {
    if (AUTH_MODE === "supabase") return;
    const normalized = normalizeUser(name);
    writeStoredUser(normalized);
    const url = new URL(window.location.href);
    url.searchParams.set("user", normalized);
    url.searchParams.set("switch", String(Date.now()));
    setSelectedUserState(getTestUser(normalized));
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };

  return {
    selectedUser,
    setSelectedUser,
    users: TEST_USERS,
    authMode: AUTH_MODE,
    isAuthLoading,
    isAuthenticated
  };
}
