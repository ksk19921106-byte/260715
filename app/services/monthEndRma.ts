export type MonthEndRmaRecord = {
  id: string;
  sales: string;
  supplier: string;
  purchaseStatus: string;
  warehouseStatus: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type MonthEndRmaSnapshot = {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
  fileName: string;
  records: MonthEndRmaRecord[];
};

export async function fetchMonthEndRmaSnapshot(): Promise<MonthEndRmaSnapshot | null> {
  const response = await fetch("/api/month-end-rma", { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as { snapshot?: MonthEndRmaSnapshot | null };
  return data.snapshot ?? null;
}

export async function uploadMonthEndRmaFile(file: File, uploadedBy: string): Promise<MonthEndRmaSnapshot> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("uploadedBy", uploadedBy);

  const response = await fetch("/api/month-end-rma", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || "RMA 파일 업로드에 실패했습니다.");
  }

  const data = (await response.json()) as { snapshot: MonthEndRmaSnapshot };
  return data.snapshot;
}
