import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readSharedCollection, writeSharedCollection } from "../../services/sharedStorageServer";
import { isLiveAuthEnabled } from "../../services/authMode";
import {
  canViewSalesName,
  forbidden,
  getAuthenticatedPortalUser,
  isVipsUser,
  unauthorized
} from "../../services/authServer";
import type { PortalUser } from "../../services/portalUsers";

export const runtime = "nodejs";

type ReceivablesMatchingSnapshot = {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
  demo: {
    orders: unknown[];
    payments: unknown[];
    matches: unknown[];
  };
  assignments: Record<string, string>;
};

type MatchingOrder = {
  id?: unknown;
  company?: unknown;
  sales?: unknown;
};

type MatchingPayment = {
  id?: unknown;
  payerName?: unknown;
};

type MatchingResult = {
  id?: unknown;
  paymentId?: unknown;
  orderIds?: unknown;
};

const snapshotPath = path.join(process.cwd(), "data", "receivables-matching.json");

function isValidSnapshot(value: unknown): value is ReceivablesMatchingSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ReceivablesMatchingSnapshot>;
  return Boolean(
    snapshot.id &&
    snapshot.uploadedAt &&
    snapshot.uploadedBy &&
    snapshot.demo &&
    Array.isArray(snapshot.demo.orders) &&
    Array.isArray(snapshot.demo.payments) &&
    Array.isArray(snapshot.demo.matches) &&
    snapshot.assignments &&
    typeof snapshot.assignments === "object"
  );
}

async function readSnapshotFile() {
  const sharedSnapshot = await readSharedCollection<ReceivablesMatchingSnapshot>("receivablesMatching");
  if (isValidSnapshot(sharedSnapshot)) return sharedSnapshot;

  try {
    const raw = await readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(raw);
    return isValidSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

async function writeSnapshotFile(snapshot: ReceivablesMatchingSnapshot) {
  await writeSharedCollection("receivablesMatching", snapshot);

  try {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedCompany(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/주식회사|\(주\)|㈜|유한회사|\[[^\]]*\]/g, "")
    .replace(/[^가-힣a-z0-9]/g, "");
}

function orderId(order: unknown) {
  return text((order as MatchingOrder)?.id);
}

function paymentId(payment: unknown) {
  return text((payment as MatchingPayment)?.id);
}

function matchId(match: unknown) {
  return text((match as MatchingResult)?.id);
}

function matchOrderIds(match: unknown) {
  const ids = (match as MatchingResult)?.orderIds;
  return Array.isArray(ids) ? ids.map(text).filter(Boolean) : [];
}

function paymentLooksRelatedToOrders(payment: unknown, orders: unknown[]) {
  const payer = normalizedCompany((payment as MatchingPayment)?.payerName);
  if (!payer) return false;
  return orders.some((order) => {
    const company = normalizedCompany((order as MatchingOrder)?.company);
    return company.length >= 2 && (payer.includes(company) || company.includes(payer));
  });
}

function scopeSnapshot(snapshot: ReceivablesMatchingSnapshot | null, user: PortalUser | null) {
  if (!snapshot || !user || isVipsUser(user)) return snapshot;

  const orders = snapshot.demo.orders.filter((order) => canViewSalesName(user, text((order as MatchingOrder)?.sales)));
  const visibleOrderIds = new Set(orders.map(orderId).filter(Boolean));
  const matchedPaymentIds = new Set(
    snapshot.demo.matches
      .filter((match) => matchOrderIds(match).some((id) => visibleOrderIds.has(id)))
      .map((match) => text((match as MatchingResult)?.paymentId))
      .filter(Boolean)
  );
  const payments = snapshot.demo.payments.filter((payment) => {
    const id = paymentId(payment);
    const assignedSales = snapshot.assignments[id];
    return (
      (assignedSales && canViewSalesName(user, assignedSales)) ||
      matchedPaymentIds.has(id) ||
      (!assignedSales && paymentLooksRelatedToOrders(payment, orders))
    );
  });
  const visiblePaymentIds = new Set(payments.map(paymentId).filter(Boolean));
  const matches = snapshot.demo.matches.filter((match) => {
    const payment = text((match as MatchingResult)?.paymentId);
    const ids = matchOrderIds(match);
    return visiblePaymentIds.has(payment) && ids.length > 0 && ids.every((id) => visibleOrderIds.has(id));
  });
  const assignments = Object.fromEntries(
    Object.entries(snapshot.assignments).filter(([id, sales]) => visiblePaymentIds.has(id) && canViewSalesName(user, sales))
  );

  return { ...snapshot, demo: { orders, payments, matches }, assignments };
}

function mergeScopedSnapshot(
  current: ReceivablesMatchingSnapshot,
  incoming: ReceivablesMatchingSnapshot,
  user: PortalUser
) {
  const allowedOrders = current.demo.orders.filter((order) => canViewSalesName(user, text((order as MatchingOrder)?.sales)));
  const allowedOrderIds = new Set(allowedOrders.map(orderId).filter(Boolean));
  const allowedPayments = current.demo.payments.filter((payment) => {
    const id = paymentId(payment);
    const assignedSales = current.assignments[id];
    return (
      (assignedSales && canViewSalesName(user, assignedSales)) ||
      (!assignedSales && paymentLooksRelatedToOrders(payment, allowedOrders)) ||
      current.demo.matches.some(
        (match) => text((match as MatchingResult)?.paymentId) === id && matchOrderIds(match).some((order) => allowedOrderIds.has(order))
      )
    );
  });
  const allowedPaymentIds = new Set(allowedPayments.map(paymentId).filter(Boolean));
  const incomingOrders = new Map(incoming.demo.orders.map((order) => [orderId(order), order]));
  const incomingPayments = new Map(incoming.demo.payments.map((payment) => [paymentId(payment), payment]));

  const orders = current.demo.orders.map((order) => {
    const id = orderId(order);
    return allowedOrderIds.has(id) && incomingOrders.has(id) ? incomingOrders.get(id)! : order;
  });
  const payments = current.demo.payments.map((payment) => {
    const id = paymentId(payment);
    return allowedPaymentIds.has(id) && incomingPayments.has(id) ? incomingPayments.get(id)! : payment;
  });
  const matches = [
    ...current.demo.matches.filter((match) => {
      const payment = text((match as MatchingResult)?.paymentId);
      return !allowedPaymentIds.has(payment) || matchOrderIds(match).some((id) => !allowedOrderIds.has(id));
    }),
    ...incoming.demo.matches.filter((match) => {
      const payment = text((match as MatchingResult)?.paymentId);
      const ids = matchOrderIds(match);
      return allowedPaymentIds.has(payment) && ids.length > 0 && ids.every((id) => allowedOrderIds.has(id));
    })
  ];
  const uniqueMatches = Array.from(new Map(matches.map((match) => [matchId(match), match])).values());
  const assignments = { ...current.assignments };
  allowedPaymentIds.forEach((id) => {
    const sales = incoming.assignments[id];
    if (!sales) {
      delete assignments[id];
      return;
    }
    if (canViewSalesName(user, sales)) assignments[id] = sales;
  });

  return {
    ...current,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.name,
    demo: { orders, payments, matches: uniqueMatches },
    assignments
  };
}

export async function GET() {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  return NextResponse.json({ snapshot: scopeSnapshot(await readSnapshotFile(), authUser) });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  const snapshot = await request.json();

  if (!isValidSnapshot(snapshot)) {
    return NextResponse.json({ message: "Invalid receivables matching snapshot" }, { status: 400 });
  }

  let snapshotToSave = snapshot;
  if (authUser && !isVipsUser(authUser)) {
    const current = await readSnapshotFile();
    if (!current) return forbidden("VIPS팀이 먼저 수금·주문 원본 데이터를 등록해야 합니다.");
    snapshotToSave = mergeScopedSnapshot(current, snapshot, authUser);
  } else if (authUser) {
    snapshotToSave = { ...snapshot, uploadedBy: authUser.name };
  }

  await writeSnapshotFile(snapshotToSave);
  return NextResponse.json({ ok: true, snapshot: scopeSnapshot(snapshotToSave, authUser) });
}
