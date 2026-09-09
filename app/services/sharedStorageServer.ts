const SHARED_STORAGE_URL = process.env.OPS_SHARED_STORAGE_URL || process.env.GOOGLE_SHEETS_WEBAPP_URL || "";
const SHARED_STORAGE_SECRET = process.env.OPS_SHARED_STORAGE_SECRET || process.env.GOOGLE_SHEETS_SECRET || "";
const SHARED_STORAGE_TIMEOUT_MS = 6500;

type SharedStorageResponse<T> = {
  ok?: boolean;
  data?: T;
  message?: string;
};

export type SharedStorageDebugResult = {
  configured: boolean;
  ok: boolean;
  message: string;
  status?: number;
  responseText?: string;
};

function enabled() {
  return Boolean(SHARED_STORAGE_URL);
}

async function postSharedStorage<T>(payload: Record<string, unknown>) {
  if (!enabled()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHARED_STORAGE_TIMEOUT_MS);

  try {
    const response = await fetch(SHARED_STORAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: SHARED_STORAGE_SECRET,
        ...payload
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) return null;
    return (await response.json()) as SharedStorageResponse<T>;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function debugSharedStorageConnection(collection = "requests"): Promise<SharedStorageDebugResult> {
  if (!enabled()) {
    return {
      configured: false,
      ok: false,
      message: "OPS_SHARED_STORAGE_URL is not configured."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHARED_STORAGE_TIMEOUT_MS);

  try {
    const response = await fetch(SHARED_STORAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: SHARED_STORAGE_SECRET,
        action: "get",
        collection
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    const responseText = await response.text();
    let parsed: SharedStorageResponse<unknown> | null = null;

    try {
      parsed = JSON.parse(responseText) as SharedStorageResponse<unknown>;
    } catch {
      return {
        configured: true,
        ok: false,
        status: response.status,
        message: "Google Apps Script did not return JSON. Check web app access permission and URL.",
        responseText: responseText.slice(0, 400)
      };
    }

    return {
      configured: true,
      ok: Boolean(response.ok && parsed?.ok),
      status: response.status,
      message: parsed?.message || (response.ok && parsed?.ok ? "Connected to Google Sheets storage." : "Google Apps Script returned an error."),
      responseText: responseText.slice(0, 400)
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function readSharedCollection<T>(collection: string) {
  const result = await postSharedStorage<T>({ action: "get", collection });
  return result?.data ?? null;
}

export async function writeSharedCollection<T>(collection: string, data: T) {
  const result = await postSharedStorage<T>({ action: "set", collection, data });
  return Boolean(result?.ok);
}

export function isSharedStorageConfigured() {
  return enabled();
}
