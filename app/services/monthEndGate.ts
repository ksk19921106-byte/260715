export type MonthEndGateStatus = "OK" | "BLOCK";

export type MonthEndGateResult = {
  user: string;
  status: MonthEndGateStatus;
  isBlocked: boolean;
  blockedReason?: "manual" | "tradeClose";
  unresolvedCount?: number;
  healthScore?: number;
};

export type BlockedUserMap = Record<string, MonthEndGateStatus>;

export async function checkMonthEndGate(user: string): Promise<MonthEndGateResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(`/api/month-end/blocked?user=${encodeURIComponent(user)}`, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Month-end gate check failed");
    }

    return (await response.json()) as MonthEndGateResult;
  } catch {
    return {
      user,
      status: "OK",
      isBlocked: false
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchBlockedUsers(): Promise<BlockedUserMap> {
  const response = await fetch("/api/month-end/blocked", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Blocked user list fetch failed");
  }

  const data = (await response.json()) as { users: BlockedUserMap };
  return data.users;
}

export async function updateBlockedUser(user: string, status: MonthEndGateStatus): Promise<BlockedUserMap> {
  const response = await fetch("/api/month-end/blocked", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user, status })
  });

  if (!response.ok) {
    throw new Error("Blocked user update failed");
  }

  const data = (await response.json()) as { users: BlockedUserMap };
  return data.users;
}
