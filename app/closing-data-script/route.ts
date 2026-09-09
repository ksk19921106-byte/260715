import { readFile } from "node:fs/promises";
import path from "node:path";
import { isLiveAuthEnabled } from "../services/authMode";
import { canViewSalesName, getAuthenticatedPortalUser, isVipsUser } from "../services/authServer";
import {
  buildTradeCloseSummary,
  getTradeCloseSummaryForUser,
  type TradeCloseRecord
} from "../services/tradeClose";

export const runtime = "nodejs";

const dataPath = path.join(process.cwd(), "data", "trade-close-records.json");

async function readRecords(): Promise<TradeCloseRecord[]> {
  try {
    return JSON.parse(await readFile(dataPath, "utf8")) as TradeCloseRecord[];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const callback = url.searchParams.get("callback") ?? "__icbanqTradeCloseCallback";
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) {
    return new Response(`window.${callback}(${JSON.stringify({ error: "LOGIN_REQUIRED", users: [], totalRecords: 0, totalUnresolved: 0 })});`, {
      status: 401,
      headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const requestedUser = url.searchParams.get("user");
  const user = authUser && !requestedUser && !isVipsUser(authUser) ? authUser.salesName : requestedUser;
  if (authUser && user && !canViewSalesName(authUser, user)) {
    return new Response(`window.${callback}(${JSON.stringify({ error: "FORBIDDEN", users: [], totalRecords: 0, totalUnresolved: 0 })});`, {
      status: 403,
      headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const dashboard = buildTradeCloseSummary(await readRecords());
  const users = authUser && !isVipsUser(authUser)
    ? dashboard.users.filter((item) => canViewSalesName(authUser, item.salesOwner))
    : dashboard.users;
  const visibleDashboard = {
    ...dashboard,
    users,
    totalRecords: users.reduce((sum, item) => sum + item.records.length, 0),
    totalUnresolved: users.reduce((sum, item) => sum + item.unresolvedCount, 0)
  };
  const payload = {
    ...visibleDashboard,
    currentUser: user ? getTradeCloseSummaryForUser(visibleDashboard, user) : undefined
  };

  return new Response(`window.${callback}(${JSON.stringify(payload)});`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

