"use client";

import { useState } from "react";
import { CalendarDays, Download, FileText, Paperclip, X } from "lucide-react";
import { updateRequest, type RequestItem, type RequestStatus } from "../services/requestStorage";

const statusStyles: Record<RequestStatus, string> = {
  요청접수: "ops-status-muted",
  "VIPS팀 확인중": "ops-status-info",
  완료: "ops-status-info",
  반려: "border-[#fecaca] bg-[#fff1f2] text-[#dc2626]"
};

function DetailCell({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-3 ${highlight ? "border-[rgba(29,80,162,0.18)] bg-[#f7faff]" : "border-[#e2ebf6] bg-white"}`}>
      <p className="text-[11px] font-[800] text-[#63748d]">{label}</p>
      <p className={`mt-1 min-h-[20px] break-words text-[13px] font-[750] ${highlight ? "text-[#1D50A2]" : "text-[#10203f]"}`}>{value || "-"}</p>
    </div>
  );
}

function previewKind(attachment: { name: string; type: string }) {
  const name = attachment.name.toLowerCase();
  if (attachment.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name)) return "image";
  if (attachment.type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  return "file";
}

function escapeHtml(value?: string) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function RequestDetailModal({
  request,
  onClose,
  canProcess = false,
  onUpdated
}: {
  request: RequestItem | null;
  onClose: () => void;
  canProcess?: boolean;
  onUpdated?: (request: RequestItem) => void;
}) {
  const [resultText, setResultText] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<RequestStatus | null>(null);
  const [sendingErp, setSendingErp] = useState(false);

  if (!request) return null;
  const detailEntries = Object.entries(request.details ?? {}).filter(([, value]) => value);
  const attachments = request.attachments ?? [];
  const attachmentFileNames = detailEntries.filter(([label]) => label.includes("첨부") || label.includes("업로드"));
  const erpEnabled = request.kind === "taxInvoice" || request.kind === "advancePayment";
  const erpTransmission = request.erpTransmission;

  const downloadRequestExcel = () => {
    const rows = [
      ["항목", "내용"],
      ["요청ID", request.id],
      ["요청종류", request.type],
      ["상태", request.status],
      ["업체명", request.companyName ?? ""],
      ["요청자", request.requester],
      ["요청일시", request.requestedAt],
      ["처리결과", request.result ?? ""],
      ["처리자", request.processor ?? ""],
      ["처리일시", request.processedAt ?? ""],
      ...detailEntries.map(([label, value]) => [label, value]),
      ["발행일자", request.issueDate ?? ""],
      ["품목명", request.itemName ?? ""],
      ["수량", request.quantity ?? ""],
      ["단가", request.unitPrice ?? ""],
      ["공급가액", request.supplyAmount ?? ""],
      ["합계액", request.totalAmount ?? ""],
      ["비고", request.note ?? ""]
    ];
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1">${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("")}</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${request.id}_요청상세.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const processRequest = async (status: RequestStatus) => {
    const fallbackResult =
      status === "완료" ? "요청 처리 완료" : status === "반려" ? "요청 반려 처리" : "VIPS팀 확인중";
    try {
      setUpdatingStatus(status);
      const nextRequest = await updateRequest({
        id: request.id,
        status,
        result: resultText.trim() || fallbackResult
      });
      onUpdated?.(nextRequest);
      setResultText("");
    } catch {
      window.alert("처리 상태 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const sendToErp = async () => {
    if (!erpEnabled) return;
    try {
      setSendingErp(true);
      const nextRequest = await updateRequest({
        id: request.id,
        status: "완료",
        result: resultText.trim() || (request.kind === "advancePayment" ? "VIPS 승인 후 선수금 ERP 처리" : "VIPS 승인 후 ERP 수동발행"),
        action: "erpSend",
        transmittedBy: "VIPS팀",
        targetSystem: "ICBANQ_ERP"
      });
      onUpdated?.(nextRequest);
      setResultText("");
    } catch {
      window.alert("ERP 전송 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSendingErp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b3e]/34 px-4 backdrop-blur-[2px]">
      <section className="max-h-[90vh] w-[940px] overflow-hidden rounded-[26px] border border-white bg-[#f7fbff] shadow-[0_28px_90px_rgba(15,35,70,0.28)]">
        <header className="flex items-start justify-between border-b border-[#e3ebf6] bg-white px-7 py-6">
          <div>
            <p className="flex items-center gap-2 text-[12px] font-[900] uppercase tracking-[0.08em] text-[#1D50A2]">
              <FileText size={16} />
              Request Detail
            </p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="text-[22px] font-[950] tracking-[-0.02em] text-[#10203f]">{request.type}</h2>
              <span className={`rounded-full border px-3 py-1 text-[12px] font-[900] ${statusStyles[request.status]}`}>{request.status}</span>
            </div>
            <p className="mt-1 text-[13px] font-[750] text-[#64748b]">{request.id}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={downloadRequestExcel} className="flex h-10 items-center gap-2 rounded-full border border-[#dce6f3] bg-[#f8fbff] px-4 text-[12px] font-[900] text-[#1D50A2] transition hover:bg-[#edf4ff]">
              <Download size={16} />
              Excel
            </button>
            <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce6f3] bg-[#f8fbff] text-[#31445e] transition hover:bg-[#edf4ff] hover:text-[#1D50A2]">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="max-h-[calc(90vh-104px)] overflow-y-auto px-7 py-6">
          <div className="grid grid-cols-3 gap-3">
            <DetailCell label="업체명" value={request.companyName} highlight />
            <DetailCell label="요청자" value={request.requester} />
            <DetailCell label="요청일시" value={request.requestedAt} />
          </div>

          <div className="mt-5 rounded-[20px] border border-[#e6edf7] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <p className="mb-3 flex items-center gap-2 text-[13px] font-[850] text-[#10203f]">
              <CalendarDays size={16} className="text-[#1D50A2]" />
              요청 입력 정보
            </p>
            {detailEntries.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-3">
                {detailEntries.map(([label, value]) => (
                  <DetailCell key={label} label={label} value={value} highlight={label.includes("금액") || label === "총금액"} />
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <DetailCell label="발행일자" value={request.issueDate} />
              <DetailCell label="품목명" value={request.itemName} highlight />
              <DetailCell label="수량" value={request.quantity} />
              <DetailCell label="단가" value={request.unitPrice} />
              <DetailCell label="공급가액" value={request.supplyAmount} />
              <DetailCell label="합계액" value={request.totalAmount} highlight />
            </div>
            <div className="mt-3">
              <DetailCell label="비고" value={request.note} />
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-[#e6edf7] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <p className="mb-3 text-[13px] font-[850] text-[#10203f]">VIPS팀 처리 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <DetailCell label="처리결과" value={request.result} highlight />
              <DetailCell label="처리자" value={request.processor} />
              <DetailCell label="처리일시" value={request.processedAt} />
              <DetailCell label="상태" value={request.status} />
            </div>

            {erpEnabled ? (
              <div className="mt-4 rounded-[18px] border border-[#d7e2f1] bg-[#fbfdff] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-[900] text-[#10203f]">ERP 연동 준비</p>
                    <p className="mt-1 text-[12px] font-[700] leading-5 text-[#64748b]">
                      VIPS 승인 후 ERP 처리 payload를 생성합니다. 현재는 Mock 승인 처리이며, API 정보 연결 시 실제 ERP 수동발행/선수금 처리로 교체됩니다.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-[900] ${
                    erpTransmission?.status === "mock_sent" || erpTransmission?.status === "sent"
                      ? "bg-[#edf4ff] text-[#1D50A2]"
                      : erpTransmission?.status === "failed"
                        ? "bg-[#fff5ec] text-[#F39945]"
                        : "bg-[#f1f5f9] text-[#64748b]"
                  }`}>
                    {erpTransmission?.status === "mock_sent"
                      ? "Mock 전송완료"
                      : erpTransmission?.status === "sent"
                        ? "ERP 전송완료"
                        : erpTransmission?.status === "failed"
                          ? "전송실패"
                          : "전송대기"}
                  </span>
                </div>

                {erpTransmission ? (
                  <div className="mt-3 grid gap-2 rounded-[14px] border border-[#e5edf7] bg-white px-3 py-3 text-[12px] font-[750] text-[#435a7b]">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#64748b]">대상 시스템</span>
                      <span className="font-[900] text-[#10203f]">{erpTransmission.system}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#64748b]">전송번호</span>
                      <span className="font-[900] text-[#1D50A2]">{erpTransmission.externalId || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#64748b]">전송일시</span>
                      <span className="font-[900] text-[#10203f]">{erpTransmission.transmittedAt || "-"}</span>
                    </div>
                    <p className="border-t border-[#eef3fa] pt-2 leading-5 text-[#64748b]">{erpTransmission.message}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {canProcess && (
              <div className="mt-3 rounded-[18px] border border-[#d7e2f1] bg-[#f8fbff] p-4">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-[850] text-[#31445e]">처리 메모 / 반려 사유</span>
                  <textarea
                    value={resultText}
                    onChange={(event) => setResultText(event.target.value)}
                    placeholder="예: 계약서 확인 완료 / 필수 서류 누락으로 반려"
                    className="h-[78px] w-full resize-none rounded-[14px] border border-[#dce6f3] bg-white px-3 py-2 text-[13px] font-[650] text-[#10203f] outline-none focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]"
                  />
                </label>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {erpEnabled ? (
                    <button
                      type="button"
                      disabled={!!updatingStatus || sendingErp}
                      onClick={sendToErp}
                      className="h-10 rounded-full bg-[#1D50A2] px-5 text-[12px] font-[900] text-white shadow-sm disabled:opacity-50"
                    >
                      {sendingErp ? "ERP 처리 중" : erpTransmission?.status === "mock_sent" ? "ERP 재처리" : request.kind === "advancePayment" ? "승인 및 선수금 ERP 처리" : "승인 및 ERP 수동발행"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!!updatingStatus}
                    onClick={() => processRequest("VIPS팀 확인중")}
                    className="h-10 rounded-full border border-[rgba(29,80,162,0.18)] bg-[#edf4ff] px-5 text-[12px] font-[900] text-[#1D50A2] disabled:opacity-50"
                  >
                    {updatingStatus === "VIPS팀 확인중" ? "저장 중" : "처리중"}
                  </button>
                  <button
                    type="button"
                    disabled={!!updatingStatus}
                    onClick={() => processRequest("완료")}
                    className="h-10 rounded-full border border-[rgba(29,80,162,0.18)] bg-[#edf4ff] px-5 text-[12px] font-[900] text-[#1D50A2] disabled:opacity-50"
                  >
                    {updatingStatus === "완료" ? "저장 중" : "완료"}
                  </button>
                  <button
                    type="button"
                    disabled={!!updatingStatus}
                    onClick={() => processRequest("반려")}
                    className="h-10 rounded-full border border-[rgba(243,153,69,0.30)] bg-[#fff5ec] px-5 text-[12px] font-[900] text-[#F39945] disabled:opacity-50"
                  >
                    {updatingStatus === "반려" ? "저장 중" : "반려"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-[20px] border border-[#e6edf7] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <p className="flex items-center gap-2 text-[13px] font-[850] text-[#10203f]">
              <Paperclip size={16} className="text-[#1D50A2]" />
              첨부파일 미리보기
            </p>
            {attachments.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-[#c6d4e9] bg-white px-3 py-3">
                {attachmentFileNames.length > 0 ? (
                  <div className="space-y-2">
                    {attachmentFileNames.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="font-[800] text-[#63748d]">{label}</span>
                        <span className="min-w-0 truncate font-[850] text-[#10203f]">{value}</span>
                      </div>
                    ))}
                    <p className="pt-1 text-[11px] font-[700] leading-5 text-[#7a8ba4]">
                      이전에 저장된 요청은 파일명만 보관되어 있습니다. 새로 제출하는 요청부터 이미지/PDF 미리보기가 함께 저장됩니다.
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] font-[700] text-[#5b6b84]">첨부된 파일이 없습니다.</p>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                {attachments.map((attachment) => (
                  <article key={`${attachment.field}-${attachment.name}`} className="overflow-hidden rounded-lg border border-[#dce6f3] bg-white">
                    <div className="flex items-center justify-between gap-3 border-b border-[#edf1f6] px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-[800] text-[#63748d]">{attachment.label}</p>
                        <p className="truncate text-[13px] font-[850] text-[#10203f]">{attachment.name}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#edf4ff] px-3 py-1 text-[11px] font-[900] text-[#1D50A2]">
                        {previewKind(attachment) === "pdf" ? "PDF" : previewKind(attachment) === "image" ? "IMAGE" : "FILE"}
                      </span>
                    </div>
                    {previewKind(attachment) === "image" ? (
                      <img src={attachment.dataUrl} alt={`${attachment.label} 미리보기`} className="max-h-[360px] w-full object-contain p-3" />
                    ) : previewKind(attachment) === "pdf" ? (
                      <iframe title={`${attachment.label} PDF 미리보기`} src={attachment.dataUrl} className="h-[420px] w-full bg-white" />
                    ) : (
                      <div className="px-3 py-4 text-[12px] font-[750] text-[#5b6b84]">이 파일 형식은 파일명만 확인할 수 있습니다.</div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

