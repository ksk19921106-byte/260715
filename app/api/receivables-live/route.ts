import { NextResponse } from "next/server";
import { isLiveAuthEnabled } from "../../services/authMode";
import { canViewSalesName, getAuthenticatedPortalUser, isVipsUser, unauthorized } from "../../services/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const RECEIVABLES_FETCH_TIMEOUT_MS = 6000;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate"
};

function buildReceivablesUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!url.searchParams.has("mode")) {
    url.searchParams.set("mode", "receivables");
  }
  url.searchParams.set("_opsTs", String(Date.now()));
  return url.toString();
}

function getReceivablesWebAppUrl() {
  return (
    process.env.OPS_RECEIVABLES_WEBAPP_URL ||
    process.env.RECEIVABLES_WEBAPP_URL ||
    process.env.NEXT_PUBLIC_RECEIVABLES_WEBAPP_URL ||
    ""
  );
}

function recordSalesName(record: Record<string, unknown>) {
  return String(record.sales ?? record.Sales ?? record.SALES ?? record.salesName ?? record.owner ?? "").trim();
}

function scopePayload(payload: Record<string, unknown>, authUser: Awaited<ReturnType<typeof getAuthenticatedPortalUser>>) {
  if (!authUser || isVipsUser(authUser)) return payload;
  const visible = (records: unknown[]) => records.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return canViewSalesName(authUser, recordSalesName(item as Record<string, unknown>));
  });

  if (Array.isArray(payload.records)) return { ...payload, records: visible(payload.records) };
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    const data = payload.data as Record<string, unknown>;
    if (Array.isArray(data.records)) return { ...payload, data: { ...data, records: visible(data.records) } };
  }
  return payload;
}

export async function GET() {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  const baseUrl = getReceivablesWebAppUrl();

  if (!baseUrl) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "OPS_RECEIVABLES_WEBAPP_URL is not configured.",
        expectedEnv: "OPS_RECEIVABLES_WEBAPP_URL"
      },
      { status: 200, headers: noStoreHeaders }
    );
  }

  try {
    const requestUrl = buildReceivablesUrl(baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RECEIVABLES_FETCH_TIMEOUT_MS);
    let response: Response;
    let text: string;

    try {
      response = await fetch(requestUrl, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      text = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    try {
      const payload = scopePayload(JSON.parse(text) as Record<string, unknown>, authUser);
      const nestedData = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? payload.data as Record<string, unknown>
        : null;
      const records =
        Array.isArray(payload?.records) ? payload.records :
        Array.isArray(nestedData?.records) ? nestedData.records :
        [];
      return NextResponse.json(
        {
          ok: response.ok,
          configured: true,
          status: response.status,
          recordCount: records.length,
          updatedAt: payload.updatedAt ?? nestedData?.updatedAt ?? null,
          payload
        },
        { headers: noStoreHeaders }
      );
    } catch {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          status: response.status,
          message: "Receivables web app did not return JSON. Check Apps Script JSON mode deployment.",
          responseText: text.slice(0, 500)
        },
        { status: 200, headers: noStoreHeaders }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message:
          error instanceof Error && error.name === "AbortError"
            ? "Receivables web app timed out. 수금현황 웹앱 응답이 늦어 이전 저장 데이터를 사용해야 합니다."
            : error instanceof Error
              ? error.message
              : "Failed to fetch receivables web app."
      },
      { status: 200, headers: noStoreHeaders }
    );
  }
}
