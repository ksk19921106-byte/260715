import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { MonthEndGateStatus } from "../../../services/monthEndGate";
import { getAllSalesNames } from "../../../services/organization";
import { buildTradeCloseSummary, getTradeCloseSummaryForUser, type TradeCloseRecord } from "../../../services/tradeClose";
import { readSharedCollection, writeSharedCollection } from "../../../services/sharedStorageServer";
import { isLiveAuthEnabled } from "../../../services/authMode";
import { canViewSalesName, forbidden, getAuthenticatedPortalUser, isVipsUser, unauthorized } from "../../../services/authServer";

export const runtime = "nodejs";

const blockedUsersPath = path.join(process.cwd(), "data", "blocked-users.json");
const tradeClosePath = path.join(process.cwd(), "data", "trade-close-records.json");
const monthEndSnapshotPath = path.join(process.cwd(), "data", "month-end-snapshot.json");
const visibleMonthEndIssueTypes = new Set(["invoice_required", "shipment_check", "long_pending"]);
const canonicalSalesNames = ["Sally", "Vincent", "Gavin", ...getAllSalesNames()];

function normalizeSalesName(value?: string | null) {
  const key = String(value ?? "").trim();
  if (!key) return "";
  return canonicalSalesNames.find((name) => name.toLowerCase() === key.toLowerCase()) ?? key;
}

function normalizeBlockedUsers(users: Record<string, MonthEndGateStatus>) {
  return Object.entries(users).reduce<Record<string, MonthEndGateStatus>>((acc, [name, status]) => {
    if (status !== "OK" && status !== "BLOCK") return acc;
    const canonicalName = normalizeSalesName(name);
    if (!canonicalName) return acc;
    // When stale duplicate keys exist, manual release wins until an admin explicitly blocks again.
    acc[canonicalName] = acc[canonicalName] === "OK" ? "OK" : status;
    return acc;
  }, {});
}

async function readBlockedUsers(): Promise<Record<string, MonthEndGateStatus>> {
  const sharedUsers = await readSharedCollection<Record<string, MonthEndGateStatus>>("blockedUsers");
  if (sharedUsers && typeof sharedUsers === "object" && !Array.isArray(sharedUsers)) {
    return normalizeBlockedUsers(sharedUsers);
  }

  try {
    return normalizeBlockedUsers(JSON.parse(await readFile(blockedUsersPath, "utf8")) as Record<string, MonthEndGateStatus>);
  } catch {
    return {};
  }
}

async function readTradeCloseRecords(): Promise<TradeCloseRecord[]> {
  try {
    return JSON.parse(await readFile(tradeClosePath, "utf8")) as TradeCloseRecord[];
  } catch {
    return [];
  }
}

async function readMonthEndSnapshotIssues(): Promise<Array<{ fSales?: string; iSales?: string; status?: string; issueType?: string; amount?: number }>> {
  const sharedSnapshot = await readSharedCollection<{
    issues?: Array<{ fSales?: string; iSales?: string; status?: string; issueType?: string; amount?: number }>;
  }>("monthEndSnapshot");
  if (sharedSnapshot?.issues) {
    return sharedSnapshot.issues;
  }

  try {
    const snapshot = JSON.parse(await readFile(monthEndSnapshotPath, "utf8")) as {
      issues?: Array<{ fSales?: string; iSales?: string; status?: string; issueType?: string; amount?: number }>;
    };
    return snapshot.issues ?? [];
  } catch {
    return [];
  }
}

async function writeBlockedUsers(users: Record<string, MonthEndGateStatus>) {
  const normalizedUsers = normalizeBlockedUsers(users);
  await writeSharedCollection("blockedUsers", normalizedUsers);

  try {
    await mkdir(path.dirname(blockedUsersPath), { recursive: true });
    await writeFile(blockedUsersPath, JSON.stringify(normalizedUsers, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

export async function GET(request: Request) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  const url = new URL(request.url);
  const requestedUser = url.searchParams.get("user");
  if (authUser && requestedUser && !canViewSalesName(authUser, requestedUser)) {
    return forbidden();
  }
  const user = authUser && !requestedUser && !isVipsUser(authUser) ? authUser.salesName : requestedUser;
  const users = await readBlockedUsers();
  const tradeCloseDashboard = buildTradeCloseSummary(await readTradeCloseRecords());
  const monthEndIssues = (await readMonthEndSnapshotIssues()).filter((issue) => issue.status === "open" && visibleMonthEndIssueTypes.has(String(issue.issueType)));

  if (!user) {
    return NextResponse.json({
      users,
      effectiveUsers: users,
      tradeClose: tradeCloseDashboard
    });
  }

  const canonicalUser = normalizeSalesName(user);
  const tradeClose = getTradeCloseSummaryForUser(tradeCloseDashboard, canonicalUser);
  const monthEndUserIssues = monthEndIssues.filter((issue) => normalizeSalesName(issue.iSales) === canonicalUser || normalizeSalesName(issue.fSales) === canonicalUser);
  const hasManualStatus = Object.prototype.hasOwnProperty.call(users, canonicalUser);
  const manualStatus = users[canonicalUser];
  const autoBlocked = monthEndUserIssues.length > 0;
  const status: MonthEndGateStatus = hasManualStatus ? manualStatus : autoBlocked ? "BLOCK" : "OK";
  const isBlocked = status === "BLOCK";

  return NextResponse.json({
    user: canonicalUser,
    status,
    isBlocked,
    blockedReason: isBlocked ? (hasManualStatus ? "manual" : "tradeClose") : undefined,
    unresolvedCount: tradeClose.unresolvedCount + monthEndUserIssues.length,
    healthScore: tradeClose.healthScore
  });
}

export async function PATCH(request: Request) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  if (authUser && !isVipsUser(authUser)) return forbidden("월마감 요청 차단 상태는 VIPS만 변경할 수 있습니다.");
  const payload = (await request.json()) as { user?: string; status?: MonthEndGateStatus };

  if (!payload.user || (payload.status !== "OK" && payload.status !== "BLOCK")) {
    return NextResponse.json({ message: "Invalid blocked user payload" }, { status: 400 });
  }

  const canonicalUser = normalizeSalesName(payload.user);
  const users = await readBlockedUsers();
  users[canonicalUser] = payload.status;
  await writeBlockedUsers(users);
  const normalizedUsers = await readBlockedUsers();

  return NextResponse.json({
    users: normalizedUsers,
    item: {
      user: canonicalUser,
      status: payload.status,
      isBlocked: payload.status === "BLOCK"
    }
  });
}

