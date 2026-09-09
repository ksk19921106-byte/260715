import { NextResponse } from "next/server";
import { getUsdKrwExchangeRates } from "../../../services/exchangeRateServer";

export const runtime = "nodejs";

export async function GET() {
  const result = await getUsdKrwExchangeRates();
  const latestAttempt = [...result.debug.attempts].reverse().find((attempt) => attempt.finalDisplayRate !== null) ?? result.debug.attempts[0] ?? null;

  return NextResponse.json({
    success: result.success,
    requestedDate: latestAttempt?.requestedDate ?? null,
    responseStatus: latestAttempt?.responseStatus ?? null,
    rawResponse: latestAttempt?.rawResponse ?? null,
    usdData: latestAttempt?.usdData ?? result.usdData,
    dealBasR: latestAttempt?.dealBasR ?? result.dealBasR,
    errorName: latestAttempt?.errorName ?? null,
    errorMessage: latestAttempt?.errorMessage ?? result.message ?? null,
    errorCause: latestAttempt?.errorCause ?? null,
    statusCode: latestAttempt?.statusCode ?? null,
    requestUrl: latestAttempt?.requestUrl ?? null,
    fallbackUsed: result.fallbackUsed,
    baseDate: result.baseDate,
    source: result.source,
    message: result.message,
    searchDate: latestAttempt?.searchDate ?? null,
    deal_bas_r: latestAttempt?.dealBasR ?? result.dealBasR,
    finalDisplayRate: result.latestRate,
    attempts: result.debug.attempts
  });
}

