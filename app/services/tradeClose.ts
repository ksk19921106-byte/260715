export type TradeCloseRecord = {
  id: string;
  salesOwner: string;
  customerName: string;
  orderNo: string;
  received: boolean;
  shipped: boolean;
  taxInvoiceIssued: boolean;
  collected: boolean;
  matched: boolean;
  incompleteType: string;
  uploadedAt: string;
};

export type TradeCloseIssueSummary = {
  shippedNoInvoice: number;
  invoiceNoCollection: number;
  receivedNoShipmentNoInvoice: number;
  matchingMissing: number;
};

export type TradeCloseUserSummary = {
  salesOwner: string;
  healthScore: number;
  unresolvedCount: number;
  issues: TradeCloseIssueSummary;
  records: TradeCloseRecord[];
};

export type TradeCloseDashboard = {
  uploadedAt: string | null;
  totalRecords: number;
  totalUnresolved: number;
  users: TradeCloseUserSummary[];
};

export const emptyTradeCloseSummary: TradeCloseUserSummary = {
  salesOwner: "",
  healthScore: 100,
  unresolvedCount: 0,
  issues: {
    shippedNoInvoice: 0,
    invoiceNoCollection: 0,
    receivedNoShipmentNoInvoice: 0,
    matchingMissing: 0
  },
  records: []
};

export function isTradeCloseRecordUnresolved(record: TradeCloseRecord) {
  return (
    Boolean(record.incompleteType.trim()) ||
    (record.shipped && !record.taxInvoiceIssued) ||
    (record.taxInvoiceIssued && !record.collected) ||
    (record.received && !record.shipped && !record.taxInvoiceIssued) ||
    !record.matched
  );
}

export function buildTradeCloseSummary(records: TradeCloseRecord[]): TradeCloseDashboard {
  const byUser = new Map<string, TradeCloseRecord[]>();

  for (const record of records) {
    const key = record.salesOwner || "미지정";
    byUser.set(key, [...(byUser.get(key) ?? []), record]);
  }

  const users = Array.from(byUser.entries())
    .map(([salesOwner, userRecords]) => {
      const unresolvedRecords = userRecords.filter(isTradeCloseRecordUnresolved);
      const issues: TradeCloseIssueSummary = {
        shippedNoInvoice: unresolvedRecords.filter((record) => record.shipped && !record.taxInvoiceIssued).length,
        invoiceNoCollection: unresolvedRecords.filter((record) => record.taxInvoiceIssued && !record.collected).length,
        receivedNoShipmentNoInvoice: unresolvedRecords.filter((record) => record.received && !record.shipped && !record.taxInvoiceIssued).length,
        matchingMissing: unresolvedRecords.filter((record) => !record.matched).length
      };
      const penalty = (issues.shippedNoInvoice + issues.invoiceNoCollection + issues.receivedNoShipmentNoInvoice) * 5;

      return {
        salesOwner,
        healthScore: Math.max(0, 100 - penalty),
        unresolvedCount: unresolvedRecords.length,
        issues,
        records: unresolvedRecords
      };
    })
    .sort((a, b) => b.unresolvedCount - a.unresolvedCount || a.salesOwner.localeCompare(b.salesOwner));

  return {
    uploadedAt: records[0]?.uploadedAt ?? null,
    totalRecords: records.length,
    totalUnresolved: users.reduce((sum, user) => sum + user.unresolvedCount, 0),
    users
  };
}

export function getTradeCloseSummaryForUser(dashboard: TradeCloseDashboard, user: string): TradeCloseUserSummary {
  return dashboard.users.find((item) => item.salesOwner === user) ?? { ...emptyTradeCloseSummary, salesOwner: user };
}

function requestJson<T>(url: string): Promise<T> {
  if (typeof fetch === "function") {
    return fetch(url, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Request failed");
      return response.json() as Promise<T>;
    });
  }

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.setRequestHeader("Cache-Control", "no-store");
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("Request failed"));
        return;
      }
      resolve(JSON.parse(request.responseText) as T);
    };
    request.onerror = () => reject(new Error("Request failed"));
    request.send();
  });
}

function requestJsonByScript<T>(user?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const callback = `__icbanqTradeCloseCallback_${Date.now()}`;
    const script = document.createElement("script");
    const query = user ? `?user=${encodeURIComponent(user)}&callback=${callback}&t=${Date.now()}` : `?callback=${callback}&t=${Date.now()}`;
    const cleanup = () => {
      delete (window as typeof window & Record<string, unknown>)[callback];
      script.remove();
    };

    (window as typeof window & Record<string, unknown>)[callback] = (payload: T) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Request failed"));
    };
    script.src = `/closing-data-script${query}`;
    document.body.appendChild(script);
  });
}

export async function fetchTradeCloseDashboard(user?: string): Promise<TradeCloseDashboard & { currentUser?: TradeCloseUserSummary }> {
  const url = user ? `/closing-data?user=${encodeURIComponent(user)}&t=${Date.now()}` : `/closing-data?t=${Date.now()}`;
  if (typeof fetch !== "function" && typeof XMLHttpRequest === "undefined") {
    return requestJsonByScript<TradeCloseDashboard & { currentUser?: TradeCloseUserSummary }>(user);
  }
  return requestJson<TradeCloseDashboard & { currentUser?: TradeCloseUserSummary }>(url);
}

