export type ExchangeRateApiResponse = {
  provider?: string;
  WARNING_UPGRADE_TO_V6?: string;
  terms?: string;
  base?: string;
  date?: string;
  time_last_updated?: number;
  rates?: Record<string, number>;
};

export type ExchangeRatePoint = {
  date: string;
  baseDate: string;
  rate: number;
};

export type ExchangeDebugAttempt = {
  requestedDate: string | null;
  searchDate: string | null;
  requestUrl: string;
  responseStatus: number | null;
  statusCode: number | null;
  rawResponse: unknown;
  usdData: ExchangeRateApiResponse | null;
  dealBasR: string | null;
  finalDisplayRate: number | null;
  error?: string;
  errorName?: string | null;
  errorMessage?: string | null;
  errorCause?: string | null;
};

export type ExchangeRateResult = {
  success: boolean;
  source: "exchangerate-api" | "fallback";
  fallbackUsed: boolean;
  baseDate: string | null;
  latestRate: number | null;
  dealBasR: string | null;
  usdData: ExchangeRateApiResponse | null;
  rates: ExchangeRatePoint[];
  message?: string;
  debug: {
    attempts: ExchangeDebugAttempt[];
  };
};

export const fallbackRates: ExchangeRatePoint[] = [
  { date: "06/24", baseDate: "2026-06-24", rate: 1547.48 }
];

const EXCHANGE_RATE_API_URL = "https://api.exchangerate-api.com/v4/latest/USD";
const EXCHANGE_RATE_TIMEOUT_MS = 3500;

function fallbackResult(message: string, attempts: ExchangeDebugAttempt[] = []): ExchangeRateResult {
  return {
    success: false,
    source: "fallback",
    fallbackUsed: true,
    baseDate: null,
    latestRate: null,
    dealBasR: null,
    usdData: null,
    rates: fallbackRates,
    message,
    debug: { attempts }
  };
}

function todayLabel() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
}

function asErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      errorName: "UnknownError",
      errorMessage: "Unknown exchange API error.",
      errorCause: null
    };
  }

  return {
    errorName: error.name,
    errorMessage: error.message,
    errorCause: error.cause ? JSON.stringify(error.cause, Object.getOwnPropertyNames(error.cause)) : null
  };
}

export async function getUsdKrwExchangeRates(): Promise<ExchangeRateResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXCHANGE_RATE_TIMEOUT_MS);

  try {
    const response = await fetch(EXCHANGE_RATE_API_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });
    clearTimeout(timeout);

    const responseStatus = response.status;
    const rawResponse = await response.json().catch(() => null);
    const apiResponse = rawResponse && typeof rawResponse === "object" ? (rawResponse as ExchangeRateApiResponse) : null;
    const krwRate = typeof apiResponse?.rates?.KRW === "number" ? apiResponse.rates.KRW : null;
    const baseDate = apiResponse?.date ?? null;
    const attempt: ExchangeDebugAttempt = {
      requestedDate: baseDate,
      searchDate: baseDate,
      requestUrl: EXCHANGE_RATE_API_URL,
      responseStatus,
      statusCode: responseStatus,
      rawResponse,
      usdData: apiResponse?.base === "USD" ? apiResponse : null,
      dealBasR: krwRate ? String(krwRate) : null,
      finalDisplayRate: krwRate,
      errorName: response.ok ? null : "HttpError",
      errorMessage: response.ok ? (krwRate ? null : "rates.KRW was not found.") : `HTTP ${response.status}`,
      errorCause: response.ok ? null : response.statusText || null
    };

    if (!response.ok || !apiResponse || apiResponse.base !== "USD" || !krwRate) {
      return fallbackResult("ExchangeRate API response did not include USD/KRW data.", [attempt]);
    }

    return {
      success: true,
      source: "exchangerate-api",
      fallbackUsed: false,
      baseDate,
      latestRate: krwRate,
      dealBasR: String(krwRate),
      usdData: apiResponse,
      rates: [
        {
          date: baseDate ? baseDate.slice(5).replace("-", "/") : todayLabel(),
          baseDate: baseDate ?? "",
          rate: krwRate
        }
      ],
      debug: { attempts: [attempt] }
    };
  } catch (error) {
    clearTimeout(timeout);
    const details = asErrorDetails(error);
    const attempt: ExchangeDebugAttempt = {
      requestedDate: null,
      searchDate: null,
      requestUrl: EXCHANGE_RATE_API_URL,
      responseStatus: null,
      statusCode: null,
      rawResponse: null,
      usdData: null,
      dealBasR: null,
      finalDisplayRate: null,
      error: details.errorMessage,
      ...details
    };

    return fallbackResult("ExchangeRate API fetch failed.", [attempt]);
  }
}
