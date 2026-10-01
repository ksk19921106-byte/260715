"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useSelectedUser, type TestUserName, type UserRole } from "../hooks/useSelectedUser";
import { canAccessSalesOperations, getOperationsScope, isSalesNameInScope } from "../services/organization";
import {
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  GraduationCap,
  Home,
  Menu,
  KeyRound,
  LogOut
} from "lucide-react";

const DALBAENG_CHALLENGE_URL = "https://script.google.com/macros/s/AKfycbxP-bK6z-aWZtNrBF-he1ljukZ_mMFZvK_Ejce98vvFur3pfnx5rxOX8_2KT_N2LQ4GpQ/exec";
const BOOKBAENG_TEAMS_URL = "https://teams.microsoft.com/l/chat/19:88655096fbd943189e74fc222f276f15@thread.v2/conversations?context=%7B%22contextType%22%3A%22chat%22%7D";

type ClosingIssueForBadge = {
  issueType?: string;
  status?: string;
  memo?: string;
  iSales?: string;
  fSales?: string;
};

const navItems: Array<{ id: string; label: string; href: string; icon: typeof Home; roles: UserRole[]; adminOnly?: boolean; managerOnly?: boolean; badge?: number | "monthEnd" }> = [
  { id: "home", label: "홈", href: "/", icon: Home, roles: ["SALES", "VIPS"] },
  { id: "requests", label: "VIPS팀 요청", href: "/requests", icon: FileText, roles: ["SALES", "VIPS"] },
  { id: "request-status", label: "나의 요청현황", href: "/request-status", icon: FileText, roles: ["SALES", "VIPS"] },
  { id: "month-end", label: "월마감 체크", href: "/month-end", icon: CalendarCheck, roles: ["SALES", "VIPS"], badge: "monthEnd" },
  { id: "collections", label: "수금관리", href: "/collections", icon: CircleDollarSign, roles: ["SALES", "VIPS"] },
  { id: "education", label: "교육센터", href: "/guide", icon: GraduationCap, roles: ["SALES", "VIPS"] },
  { id: "performance", label: "내 운영 리포트", href: "/performance", icon: BadgeCheck, roles: ["SALES", "VIPS"] },
  { id: "sales-ops", label: "팀별 운영현황", href: "/sales-ops", icon: BarChart3, roles: ["SALES"], managerOnly: true },
  { id: "vips-ops", label: "VIPS 운영", href: "/vips-ops", icon: BarChart3, roles: ["VIPS"], adminOnly: true }
];

function Logo() {
  return (
    <div className="rounded-[16px] bg-white px-3 py-2 shadow-[0_10px_24px_rgba(13,43,94,0.2)]">
      <div className="relative h-[30px] w-[150px]">
        <Image src="/assets/brand/icbanq-logo-en.png" alt="ICBANQ" fill sizes="150px" className="object-contain" />
      </div>
      <span className="mt-1 block text-[10px] font-[900] uppercase tracking-[0.1em] text-[#1D50A2]">OPS Portal</span>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navHref(href: string, userName: string, extra?: string, includeDemoUser = true) {
  const query = new URLSearchParams(includeDemoUser ? { user: userName } : {});
  if (extra) {
    const [key, value] = extra.split("=");
    query.set(key, value ?? "1");
  }
  const search = query.toString();
  return search ? `${href}?${search}` : href;
}

function SignedInUserCard({ selectedUser }: { selectedUser: ReturnType<typeof useSelectedUser>["selectedUser"] }) {
  return (
    <div className="rounded-[18px] border border-white/15 bg-white/10 px-3 py-3 shadow-[0_10px_24px_rgba(8,47,126,0.18)]">
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-sm">
          <Image src="/assets/brand/bandol-face.png" alt="ICBANQ 프로필" fill sizes="36px" className="object-contain p-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p data-selected-user-name="true" className="truncate text-[13px] font-[850] text-white">
            {selectedUser.koreanName ? `${selectedUser.koreanName} (${selectedUser.name})` : selectedUser.name}
          </p>
          <p data-selected-user-meta="true" className="truncate text-xs font-[650] text-white/70">
            {selectedUser.team} · {selectedUser.role === "VIPS" ? "VIPS" : "SALES"}
          </p>
        </div>
      </div>
    </div>
  );
}

function TestUserSwitcher({
  selectedUser,
  users,
  onChange,
  pathname
}: {
  selectedUser: ReturnType<typeof useSelectedUser>["selectedUser"];
  users: ReturnType<typeof useSelectedUser>["users"];
  onChange: (name: TestUserName) => void;
  pathname: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/15 bg-white/10 px-3 py-2.5 shadow-[0_10px_24px_rgba(8,47,126,0.18)]">
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-sm">
          <Image src="/assets/brand/bandol-face.png" alt="ICBANQ 반돌이" fill sizes="36px" className="object-contain p-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p data-selected-user-name="true" className="truncate text-[13px] font-[850] text-white">
            {selectedUser.name}님
          </p>
          <p data-selected-user-meta="true" className="text-xs font-[650] text-white/70">
            {selectedUser.team} · {selectedUser.role}
          </p>
        </div>
        <ChevronDown size={15} className="text-white/80" />
      </div>
      <details className="group mt-2.5">
        <summary className="flex h-8 cursor-pointer list-none items-center justify-between rounded-xl bg-white/10 px-3 text-[11px] font-[900] text-white/80 transition hover:bg-white/18">
          <span>테스트 계정 전환</span>
          <ChevronRight size={14} className="transition group-open:rotate-90" />
        </summary>
        <div className="mt-2 grid max-h-[280px] gap-1.5 overflow-auto pr-1">
          {users.map((user) => {
            const active = selectedUser.name === user.name;
            const switchHref = `${pathname}?user=${encodeURIComponent(user.name)}`;
            return (
              <a
                key={user.name}
                href={switchHref}
                data-test-user={user.name}
                data-test-role={user.role}
                onClick={(event) => {
                  event.preventDefault();
                  onChange(user.name);
                }}
                className={`flex h-9 items-center justify-between rounded-xl px-3 text-left text-[12px] font-[850] transition ${
                  active ? "bg-white text-[#1D50A2] shadow-sm" : "bg-white/10 text-white/85 hover:bg-white/18"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {user.name}{user.koreanName ? ` · ${user.koreanName}` : ""}
                </span>
                <span className={`ml-2 shrink-0 ${active ? "text-[#1D50A2]/70" : "text-white/70/75"}`}>{user.team}</span>
              </a>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function SidebarChallengeCard() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/15 bg-white/10 p-3.5 shadow-[0_10px_24px_rgba(8,47,126,0.18)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-[950] text-white">사내 챌린지</p>
          <p className="mt-0.5 text-[11px] font-[750] text-white/70">운동 · 독서 캠페인</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={DALBAENG_CHALLENGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[122px] flex-col items-center justify-center rounded-[16px] border border-white/20 bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-white"
        >
          <div className="relative flex h-[82px] w-[82px] items-center justify-center">
            <Image src="/assets/brand/bandol-full.png" alt="달뱅 챌린지" fill sizes="90px" className="object-contain object-center drop-shadow-sm" />
          </div>
          <p className="mt-1 text-[12px] font-[950] text-[#1D50A2]">달뱅</p>
        </a>
        <a
          href={BOOKBAENG_TEAMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[122px] flex-col items-center justify-center rounded-[16px] border border-white/20 bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-white"
        >
          <div className="relative flex h-[82px] w-[82px] items-center justify-center">
            <Image src="/assets/brand/bansoon-full.png" alt="북뱅 챌린지" fill sizes="90px" className="object-contain object-center drop-shadow-sm" />
          </div>
          <p className="mt-1 text-[12px] font-[950] text-[#1D50A2]">북뱅</p>
        </a>
      </div>
    </div>
  );
}

function isVisibleMonthEndIssue(issue: ClosingIssueForBadge) {
  return issue.issueType === "invoice_required" ||
    issue.issueType === "shipment_check" ||
    issue.issueType === "long_pending" ||
    issue.issueType === "deduct_check" ||
    issue.issueType === "sales_unshipped";
}

function countMonthEndBadge(selectedUser: ReturnType<typeof useSelectedUser>["selectedUser"]) {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem("icbanq.ops.monthEnd.latestSnapshot");
    if (!raw) return 0;
    const snapshot = JSON.parse(raw) as { issues?: ClosingIssueForBadge[] };
    const scope = getOperationsScope(selectedUser);
    return (snapshot.issues ?? []).filter((issue) => {
      if (issue.status && issue.status !== "open") return false;
      if (!isVisibleMonthEndIssue(issue)) return false;
      if (selectedUser.role === "VIPS") return true;
      if (scope.canViewOperations) return isSalesNameInScope(issue.iSales || "", scope) || isSalesNameInScope(issue.fSales || "", scope);
      return issue.iSales === selectedUser.salesName || issue.fSales === selectedUser.salesName;
    }).length;
  } catch {
    return 0;
  }
}

export function OpsShell({ children, compactMobile = false }: { children: ReactNode; compactMobile?: boolean }) {
  const pathname = usePathname();
  const { selectedUser, setSelectedUser, users, authMode, isAuthLoading } = useSelectedUser();
  const [monthEndBadge, setMonthEndBadge] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const sync = () => setMonthEndBadge(countMonthEndBadge(selectedUser));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("month-end-review-changed", sync);
    window.addEventListener("icbanq:selected-user-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("month-end-review-changed", sync);
      window.removeEventListener("icbanq:selected-user-change", sync);
    };
  }, [selectedUser]);

  if (authMode === "supabase" && isAuthLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eaf3ff] text-[#1D50A2]">
        <div className="rounded-2xl border border-[#cddcf1] bg-white px-6 py-4 text-sm font-semibold shadow-sm">로그인 정보를 확인하고 있습니다.</div>
      </main>
    );
  }

  const includeDemoUser = authMode === "demo";

  const handleLogout = async () => {
    if (authMode === "demo") return;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/login");
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-[#eaf3ff] text-[#111827]">
      <div className={compactMobile ? "grid min-h-screen grid-cols-1 content-start sm:grid-cols-[252px_minmax(0,1fr)]" : "grid min-h-screen grid-cols-[252px_minmax(0,1fr)]"}>
        <aside className={`${compactMobile ? "relative w-auto min-h-0 self-start sm:sticky sm:w-[228px] sm:min-h-[calc(100vh-24px)]" : "sticky min-h-[calc(100vh-24px)] w-[228px]"} top-3 m-3 flex flex-col overflow-hidden rounded-[26px] bg-[#1D50A2] px-3.5 py-4 text-white shadow-[14px_0_34px_rgba(29,80,162,0.2)]`}>
          <div className={compactMobile ? "flex items-center justify-between gap-3 sm:block" : ""}>
            <Logo />
            {compactMobile ? (
              <button type="button" aria-label="메뉴" title="메뉴" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((value) => !value)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 sm:hidden">
                <Menu size={20} />
              </button>
            ) : null}
          </div>
          <div className={`mt-4 ${compactMobile && !mobileMenuOpen ? "hidden sm:block" : ""}`}>
            {authMode === "demo" ? (
              <TestUserSwitcher selectedUser={selectedUser} users={users} onChange={setSelectedUser} pathname={pathname} />
            ) : (
              <SignedInUserCard selectedUser={selectedUser} />
            )}
          </div>

          <nav className={`mt-5 space-y-1 ${compactMobile && !mobileMenuOpen ? "hidden sm:block" : ""}`}>
            {navItems.filter((item) =>
              item.roles.includes(selectedUser.role) &&
              (!item.adminOnly || selectedUser.role === "VIPS") &&
              (!item.managerOnly || canAccessSalesOperations(selectedUser))
            ).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.id}
                  href={navHref(item.href, selectedUser.name, undefined, includeDemoUser)}
                  onClick={(event) => {
                    event.preventDefault();
                    window.location.href =
                      item.id === "home"
                        ? navHref("/", selectedUser.name, `home-reset=${Date.now()}`, includeDemoUser)
                        : navHref(item.href, selectedUser.name, undefined, includeDemoUser);
                  }}
                  className={`group flex h-[40px] w-full items-center gap-2.5 rounded-[16px] border bg-white px-2.5 text-[12px] font-[850] text-[#1D50A2] transition ${
                    active ? "border-white shadow-[0_8px_18px_rgba(8,47,126,0.18)]" : "border-white/40 hover:border-white hover:shadow-sm"
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-[#eaf3ff] text-[#1D50A2]" : "bg-[#edf4ff] text-[#1D50A2] group-hover:bg-[#e4efff]"}`}>
                    <item.icon size={16} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#1D50A2]">{item.label}</span>
                  {(item.badge === "monthEnd" ? monthEndBadge : item.badge) ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F39945] px-1.5 text-[11px] font-[900] text-white">
                      {item.badge === "monthEnd" ? monthEndBadge : item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className={`mt-auto space-y-3 pt-5 ${compactMobile && !mobileMenuOpen ? "hidden sm:block" : ""}`}>
            <SidebarChallengeCard />
            {authMode !== "demo" && <Link href="/account/password" className="flex h-10 items-center gap-3 rounded-lg px-3 text-xs font-bold text-[#1d50a2] hover:bg-white"><KeyRound size={16} />비밀번호 변경</Link>}
            <button onClick={handleLogout} aria-label={authMode === "demo" ? "시연 모드" : "로그아웃"} className="flex h-[40px] w-full items-center gap-3 rounded-[12px] bg-white/10 px-3 text-[12px] font-[850] text-white/85 hover:bg-white/18 hover:text-white">
              <LogOut size={16} />
              {authMode === "demo" ? "시연 모드" : "로그아웃"}
            </button>
          </div>
        </aside>

        {children}
      </div>
    </main>
  );
}


