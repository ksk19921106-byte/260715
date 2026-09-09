import { NextResponse } from "next/server";
import { getUsdKrwExchangeRates } from "../../services/exchangeRateServer";

export const runtime = "nodejs";

export async function GET() {
  const result = await getUsdKrwExchangeRates();

  return NextResponse.json({
    success: result.success,
    source: result.source,
    fallbackUsed: result.fallbackUsed,
    baseDate: result.baseDate,
    latestRate: result.latestRate,
    dealBasR: result.dealBasR,
    usdData: result.usdData,
    rates: result.rates,
    message: result.message
  });
}

