export type InvoiceOrder = { id: string; companyId: string; label: string; supply: number; vat: number; linked: number };
export type InvoiceDraft = { mode: "orders" | "advance"; companyId: string; orderIds: string[]; title: string; date: string; supply: number; vat: number; note: string };
export type InvoiceAllocation = { orderId: string; amount: number };
export type WorkflowInvoice = { id: string; companyId: string; total: number; title: string; allocations: InvoiceAllocation[] };

export const orderAvailable = (order: InvoiceOrder) => order.supply + order.vat - order.linked;
export const invoiceAvailable = (invoice: WorkflowInvoice) => invoice.total - invoice.allocations.reduce((total, row) => total + row.amount, 0);

export function draftProblem(draft: InvoiceDraft, orders: InvoiceOrder[]): string | null {
  if (!draft.companyId) return "거래처를 선택해주세요.";
  if (!draft.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "계산서 표시 품목과 발행 희망일을 입력해주세요.";
  if (draft.mode === "advance") {
    if (draft.orderIds.length) return "선발행 요청에는 주문을 미리 지정하지 않습니다.";
    if (!Number.isSafeInteger(draft.supply) || draft.supply <= 0 || !Number.isSafeInteger(draft.vat) || draft.vat < 0 || !Number.isSafeInteger(draft.supply + draft.vat)) return "공급가액과 세액을 원 단위의 유효한 금액으로 입력해주세요.";
  } else {
    if (!draft.orderIds.length) return "발행할 주문을 선택해주세요.";
    if (new Set(draft.orderIds).size !== draft.orderIds.length) return "중복 주문이 있습니다.";
    for (const id of draft.orderIds) {
      const order = orders.find(row => row.id === id);
      if (!order || order.companyId !== draft.companyId || order.linked !== 0) return "대상 주문의 거래처와 발행 가능 상태를 다시 확인해주세요.";
    }
  }
  return null;
}

export function allocationProblem(invoice: WorkflowInvoice, order: InvoiceOrder | undefined, amount: number): string | null {
  if (!order || order.companyId !== invoice.companyId) return "같은 거래처의 주문을 선택해주세요.";
  if (!Number.isSafeInteger(amount) || amount <= 0) return "연결 금액을 원 단위로 입력해주세요.";
  if (amount > invoiceAvailable(invoice)) return "계산서의 미연결 금액을 초과했습니다.";
  if (amount > orderAvailable(order)) return "주문의 연결 가능 금액을 초과했습니다.";
  return null;
}
