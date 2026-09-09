"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { BlockedGateDialog } from "../../components/BlockedGateDialog";
import { REQUEST_FORM_CONFIGS, type RequestKind, type RequestFormValues } from "../../services/formValidation";
import { checkMonthEndGate } from "../../services/monthEndGate";
import { saveRequest } from "../../services/requestStorage";
import { useSelectedUser } from "../../hooks/useSelectedUser";

type FormValues = Record<string, string>;

const trackingOptions = ["매칭 필요", "매칭 불필요"];
const vipsOwners = ["Vincent", "Sally", "Gavin"];

function previewKind(file: { name: string; type: string }) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name)) return "image";
  if (file.type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  return "file";
}

function Field({
  label,
  name,
  values,
  setValues,
  type = "text",
  required = false,
  placeholder = ""
}: {
  label: string;
  name: string;
  values: FormValues;
  setValues: (updater: (current: FormValues) => FormValues) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [filePreview, setFilePreview] = useState<{ name: string; type: string; url: string } | null>(null);

  useEffect(() => {
    return () => {
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
    };
  }, [filePreview]);

  const updateValue = (event: ChangeEvent<HTMLInputElement> | FormEvent<HTMLInputElement>) => {
    const target = event.currentTarget;
    if (type === "file") {
      const file = target.files?.[0];
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      setFilePreview(file ? { name: file.name, type: file.type, url: URL.createObjectURL(file) } : null);
      if (!file) {
        setValues((current) => {
          const { [`${name}PreviewData`]: _data, [`${name}PreviewType`]: _type, [`${name}PreviewLabel`]: _label, ...rest } = current;
          return { ...rest, [name]: "" };
        });
        return;
      }
      setValues((current) => ({ ...current, [name]: file.name, [`${name}PreviewType`]: file.type, [`${name}PreviewLabel`]: label }));
      if (previewKind(file) !== "file") {
        const reader = new FileReader();
        reader.onload = () => {
          setValues((current) => ({ ...current, [`${name}PreviewData`]: String(reader.result ?? "") }));
        };
        reader.readAsDataURL(file);
      }
      return;
    }

    const nextValue = target.value;
    setValues((current) => ({ ...current, [name]: nextValue }));
  };

  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-[13px] font-[850] text-[#1d2f4f]">
        {label}
        {required && <span className="text-[#F39945]">*</span>}
      </span>
      <input
        name={name}
        aria-label={label}
        type={type}
        value={type === "file" ? undefined : values[name] ?? ""}
        placeholder={placeholder}
        onInput={type === "file" ? undefined : updateValue}
        onChange={updateValue}
        className="h-11 w-full rounded-xl border border-[#dce6f3] bg-white px-3 text-[14px] font-[650] text-[#10203f] outline-none focus:border-[#075bdc] focus:ring-2 focus:ring-[#dbe7f5]"
      />
      {type === "file" && filePreview && (
        <div className="mt-3 overflow-hidden rounded-[16px] border border-[#dce6f3] bg-[#f8fbff]">
          <div className="flex items-center justify-between gap-2 border-b border-[#e7ecf4] px-3 py-2">
            <span className="min-w-0 truncate text-[12px] font-[900] text-[#10203f]">{filePreview.name}</span>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-[900] text-[#64748b]">미리보기</span>
          </div>
          {previewKind(filePreview) === "image" ? (
            <img src={filePreview.url} alt={`${label} 미리보기`} className="h-[180px] w-full object-contain p-3" />
          ) : previewKind(filePreview) === "pdf" ? (
            <iframe title={`${label} PDF 미리보기`} src={filePreview.url} className="h-[220px] w-full bg-white" />
          ) : (
            <div className="px-3 py-4 text-[12px] font-[750] text-[#64748b]">이 파일 형식은 파일명만 확인할 수 있습니다.</div>
          )}
        </div>
      )}
    </label>
  );
}

function CalculatedField({ label, value, helper }: { label: string; value: string; helper?: string }) {
  const calcKey = label.includes("공급가액") ? "supply" : label.includes("부가세액") ? "vat" : label.includes("합계액") ? "total" : undefined;

  return (
    <div className="block">
      <span className="mb-2 block text-[13px] font-[850] text-[#1d2f4f]">{label}</span>
      <div className="flex h-11 w-full items-center justify-between rounded-xl border border-[#dce6f3] bg-[#f4f8fd] px-3 text-[14px] font-[850] text-[#10203f]">
        <span data-tax-calc={calcKey}>{value}</span>
        {helper && <span className="text-[11px] font-[800] text-[#7a8aa3]">{helper}</span>}
      </div>
    </div>
  );
}

function TextArea({
  label,
  name,
  values,
  setValues,
  required = false,
  placeholder = ""
}: {
  label: string;
  name: string;
  values: FormValues;
  setValues: (updater: (current: FormValues) => FormValues) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="col-span-2 block">
      <span className="mb-2 flex items-center gap-1 text-[13px] font-[850] text-[#1d2f4f]">
        {label}
        {required && <span className="text-[#F39945]">*</span>}
      </span>
      <textarea
        value={values[name] ?? ""}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        placeholder={placeholder}
        className="h-[96px] w-full resize-none rounded-xl border border-[#dce6f3] bg-white px-3 py-3 text-[14px] font-[650] text-[#10203f] outline-none focus:border-[#075bdc] focus:ring-2 focus:ring-[#dbe7f5]"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  values,
  setValues,
  required = false,
  options
}: {
  label: string;
  name: string;
  values: FormValues;
  setValues: (updater: (current: FormValues) => FormValues) => void;
  required?: boolean;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-[13px] font-[850] text-[#1d2f4f]">
        {label}
        {required && <span className="text-[#F39945]">*</span>}
      </span>
      <select
        value={values[name] ?? ""}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        className="h-11 w-full rounded-xl border border-[#dce6f3] bg-white px-3 text-[14px] font-[650] text-[#10203f] outline-none focus:border-[#075bdc] focus:ring-2 focus:ring-[#dbe7f5]"
      >
        <option value="">선택해주세요</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function OperationNote({ kind }: { kind: RequestKind }) {
  const notes: Record<RequestKind, { title: string; body: string; risks: string[] }> = {
    taxInvoice: {
      title: "세금계산서는 매출 확정의 기준입니다.",
      body: "품목, 수량, 단가를 기준으로 공급가액과 VAT를 계산합니다. 발행월과 트래킹 매칭 여부를 함께 확인해주세요.",
      risks: ["공급가액 = 수량 x 단가", "VAT = 공급가액 x 10%", "333원의 VAT는 33원"]
    },
    revisedTaxInvoice: {
      title: "전월 계산서 수정은 반드시 확인이 필요합니다.",
      body: "전월 계산서 수정은 월마감, 부가세 신고, 수금 흐름에 영향을 줄 수 있습니다. 수정 가능 여부를 먼저 확인해주세요.",
      risks: ["매출 흐름 영향", "부가세 신고 영향", "수금 및 회계 반영 영향"]
    },
    reverseIssueApproval: { title: "역발행 승인 요청", body: "역발행 사이트, 최종금액, 건수를 정확히 남겨주세요.", risks: ["사이트명 확인", "최종금액 확인", "건수 확인"] },
    advancePayment: { title: "선수금 처리 요청", body: "선수금 일부사용 또는 전부소진 처리에 필요한 IKI 기준 링크를 정확히 남겨주세요.", risks: ["IKI Tax ID 확인", "선수금/수금/PO 링크 확인", "G/P, S/P, U/P 금액 확인"] },
    cardPayment: { title: "카드결제 확인 요청", body: "카드매출전표가 누락되면 거래 확인과 수금 매칭이 지연될 수 있습니다.", risks: ["카드전표 첨부", "결제금액 확인", "거래처 확인"] },
    guaranteeInsurance: { title: "보증보험 요청", body: "계약서 첨부와 계약금액 확인이 필요합니다.", risks: ["PDF/JPG/JPEG/PNG", "VAT 포함 계약금액", "계약기간 확인"] },
    invoiceMatching: { title: "계산서 매칭", body: "거래 흐름과 세금계산서를 연결하거나 해제하는 요청입니다.", risks: ["계산서 링크 확인", "트래킹 URL 확인", "요청 사유 입력"] },
    collectionMatching: { title: "수금 매칭", body: "입금 흐름과 거래/세금계산서 흐름을 연결하거나 해제하는 요청입니다.", risks: ["수금 링크 확인", "트래킹 URL 확인", "세금계산서 링크 확인"] },
    monthEndCheck: { title: "월마감 체크", body: "요청 전 미종료 거래가 남아 있는지 먼저 확인해주세요.", risks: ["출고 확인", "계산서 확인", "Deduct 확인"] }
  };
  const note = notes[kind];

  return (
    <aside className="rounded-[22px] border border-[#e7ecf4] bg-[#f8fbff] p-5">
      <p className="text-[15px] font-[900] text-[#10203f]">{note.title}</p>
      <p className="mt-2 text-[12px] font-[650] leading-5 text-[#667085]">{note.body}</p>
      <div className="mt-4 space-y-2">
        {note.risks.map((risk) => (
          <p key={risk} className="flex items-start gap-2 text-[12px] font-[750] leading-5 text-[#34496b]">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#1D50A2]" />
            {risk}
          </p>
        ))}
      </div>
    </aside>
  );
}

function AssigneeSelector({
  values,
  setValues
}: {
  values: FormValues;
  setValues: (updater: (current: FormValues) => FormValues) => void;
}) {
  const selected = (values.assignedOwners ?? "").split(",").map((item) => item.trim()).filter(Boolean);

  const toggleOwner = (owner: string) => {
    setValues((current) => {
      const currentOwners = (current.assignedOwners ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      const nextOwners = currentOwners.includes(owner) ? currentOwners.filter((item) => item !== owner) : [...currentOwners, owner];
      return { ...current, assignedOwners: nextOwners.join(",") };
    });
  };

  return (
    <section className="mb-5 rounded-[18px] border border-[#e7ecf4] bg-[#f8fbff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-[950] text-[#10203f]">VIPS 담당자 선택</p>
          <p className="mt-1 text-[11px] font-[750] text-[#64748b]">선택된 담당자는 요청현황에서 배정받은 요청으로 확인할 수 있습니다.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-[900] text-[#64748b]">{selected.length}/3명 선택</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {vipsOwners.map((owner) => {
          const active = selected.includes(owner);
          return (
            <button
              key={owner}
              type="button"
              onClick={() => toggleOwner(owner)}
              className={`h-10 rounded-full px-4 text-[12px] font-[950] transition ${
                active ? "bg-[#1D50A2] text-white shadow-sm" : "border border-[#dce6f3] bg-white text-[#475569] hover:bg-[#edf4ff] hover:text-[#1D50A2]"
              }`}
            >
              {owner}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TaxInvoiceFields({
  values,
  setValues
}: {
  values: FormValues;
  setValues: (updater: (current: FormValues) => FormValues) => void;
}) {
  return (
    <>
      <Field label="업체명" name="companyName" values={values} setValues={setValues} required placeholder="예: 아이씨뱅큐" />
      <div className="col-span-2 rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-[900] text-[#10203f]">품목 내역</p>
            <p className="mt-1 text-[11px] font-[650] text-[#7a8ba4]">품목이 여러 개인 경우 추가해서 입력할 수 있습니다.</p>
          </div>
          <button type="button" data-add-tax-line="true" className="h-9 rounded-xl bg-[#edf4ff] px-3 text-[12px] font-[900] text-[#1D50A2]">
            + 품목 추가
          </button>
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} data-tax-line={index} className={`grid grid-cols-[1.2fr_90px_120px_130px_36px] items-end gap-3 rounded-2xl border border-[#edf1f6] bg-white p-3 ${index === 0 ? "" : "hidden"}`}>
              <label className="block">
                <span className="mb-2 block text-[12px] font-[850] text-[#1d2f4f]">품목 {index + 1}</span>
                <input name={index === 0 ? "itemName" : `itemName_${index + 1}`} data-tax-item={index} aria-label={`품목 ${index + 1}`} placeholder="예: 전자부품 공급" className="h-10 w-full rounded-xl border border-[#dce6f3] bg-white px-3 text-[13px] font-[650] text-[#10203f] outline-none focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[12px] font-[850] text-[#1d2f4f]">수량</span>
                <input name={index === 0 ? "quantity" : `quantity_${index + 1}`} data-tax-quantity={index} aria-label={`수량 ${index + 1}`} type="number" placeholder="0" className="h-10 w-full rounded-xl border border-[#dce6f3] bg-white px-3 text-[13px] font-[650] text-[#10203f] outline-none focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[12px] font-[850] text-[#1d2f4f]">단가</span>
                <input name={index === 0 ? "unitPrice" : `unitPrice_${index + 1}`} data-tax-unit={index} aria-label={`단가 ${index + 1}`} type="number" placeholder="0" className="h-10 w-full rounded-xl border border-[#dce6f3] bg-white px-3 text-[13px] font-[650] text-[#10203f] outline-none focus:border-[#1D50A2] focus:ring-2 focus:ring-[#dbe7f5]" />
              </label>
              <div>
                <span className="mb-2 block text-[12px] font-[850] text-[#1d2f4f]">공급가액</span>
                <div className="flex h-10 items-center rounded-xl border border-[#dce6f3] bg-[#f4f8fd] px-3 text-[13px] font-[900] text-[#10203f]">
                  <span data-tax-line-supply={index}>0원</span>
                </div>
              </div>
              <button type="button" data-remove-tax-line={index} className={`h-10 rounded-xl border border-[#dce6f3] text-[12px] font-[900] text-[#7a8ba4] ${index === 0 ? "invisible" : ""}`}>삭제</button>
            </div>
          ))}
        </div>
      </div>
      <CalculatedField label="공급가액" value="0원" helper="자동계산" />
      <CalculatedField label="부가세액" value="0원" helper="10%" />
      <CalculatedField label="합계액" value="0원" helper="공급가액+VAT" />
      <Field label="발행일자" name="issueDate" values={values} setValues={setValues} required type="date" />
      <SelectField label="트래킹 매칭 여부" name="trackingMatchStatus" values={values} setValues={setValues} required options={trackingOptions} />
      {values.trackingMatchStatus === "매칭 필요" && (
        <Field label="트래킹 번호" name="trackingNumber" values={values} setValues={setValues} placeholder="Tracking Number 입력" />
      )}
      <TextArea label="비고" name="note" values={values} setValues={setValues} placeholder="추가 확인사항을 입력해주세요." />
    </>
  );
}

function RequestFields({ kind, values, setValues }: { kind: RequestKind; values: FormValues; setValues: (updater: (current: FormValues) => FormValues) => void }) {
  if (kind === "taxInvoice") return <TaxInvoiceFields values={values} setValues={setValues} />;
  if (kind === "revisedTaxInvoice") return <><SelectField label="구분" name="revisionRequestType" values={values} setValues={setValues} required options={["마이너스 계산서 승인", "수정발행"]} /><Field label="기존 세금계산서 링크" name="originalInvoiceLink" values={values} setValues={setValues} required /><Field label="수정사항" name="revisionChange" values={values} setValues={setValues} required /><TextArea label="수정이유" name="revisionReason" values={values} setValues={setValues} required /><TextArea label="비고" name="note" values={values} setValues={setValues} /></>;
  if (kind === "reverseIssueApproval") return <><Field label="역발행 세금계산서 사이트" name="reverseIssueSite" values={values} setValues={setValues} required /><Field label="최종금액" name="reverseFinalAmount" values={values} setValues={setValues} required type="number" /><Field label="건수" name="reverseIssueCount" values={values} setValues={setValues} required type="number" /><TextArea label="비고" name="note" values={values} setValues={setValues} /></>;
  if (kind === "advancePayment") return <><SelectField label="처리 구분" name="advanceUsageType" values={values} setValues={setValues} required options={["일부사용", "전부소진"]} /><Field label="IKI Tax ID" name="ikiTaxId" values={values} setValues={setValues} required placeholder="예: TAX-20260709-001" /><Field label="선수금 링크" name="advancePaymentLink" values={values} setValues={setValues} required placeholder="IKI 선수금 링크" /><Field label="수금 링크" name="advanceCollectionLink" values={values} setValues={setValues} required placeholder="IKI 수금 링크" /><Field label="PO 링크" name="poLink" values={values} setValues={setValues} required placeholder="PO 또는 Tracking 링크" /><Field label="G/P" name="gpAmount" values={values} setValues={setValues} required type="number" /><Field label="S/P" name="spAmount" values={values} setValues={setValues} required type="number" /><Field label="U/P" name="upAmount" values={values} setValues={setValues} required type="number" /><TextArea label="비고" name="note" values={values} setValues={setValues} placeholder="일부사용 기준, 차액, 특이사항을 입력해주세요." /></>;
  if (kind === "cardPayment") return <><Field label="업체명/고객명" name="companyName" values={values} setValues={setValues} required /><Field label="카드전표 첨부" name="cardReceiptName" values={values} setValues={setValues} required type="file" /><TextArea label="비고" name="note" values={values} setValues={setValues} /></>;
  if (kind === "guaranteeInsurance") return <><SelectField label="요청 구분" name="guaranteeRequestType" values={values} setValues={setValues} required options={["나라장터 건", "일반 계약 건"]} /><SelectField label="보증보험 종류" name="guaranteeType" values={values} setValues={setValues} required options={["계약이행", "하자이행", "선금이행"]} /><Field label="업체명" name="companyName" values={values} setValues={setValues} required /><Field label="보증요율" name="guaranteeRate" values={values} setValues={setValues} required /><Field label="보증기간" name="guaranteePeriod" values={values} setValues={setValues} required /><Field label="계약명" name="contractName" values={values} setValues={setValues} required /><Field label="계약금액(VAT 포함)" name="contractAmount" values={values} setValues={setValues} required type="number" /><Field label="계약서 첨부" name="contractFileName" values={values} setValues={setValues} required type="file" /></>;
  if (kind === "invoiceMatching") return <><SelectField label="요청 구분" name="invoiceMatchType" values={values} setValues={setValues} required options={["계산서매칭", "계산서매칭해제"]} /><Field label="업체명" name="companyName" values={values} setValues={setValues} required /><Field label="계산서 링크" name="invoiceLink" values={values} setValues={setValues} required /><Field label="트래킹 URL" name="trackingUrl" values={values} setValues={setValues} required /><TextArea label="요청 사유" name="matchReason" values={values} setValues={setValues} required /><TextArea label="메모" name="note" values={values} setValues={setValues} /></>;
  if (kind === "collectionMatching") return <><SelectField label="요청 구분" name="collectionMatchType" values={values} setValues={setValues} required options={["수금매칭", "수금매칭해제"]} /><Field label="업체명" name="companyName" values={values} setValues={setValues} required /><Field label="수금 링크" name="collectionLink" values={values} setValues={setValues} required /><Field label="트래킹 URL" name="trackingUrl" values={values} setValues={setValues} required /><Field label="세금계산서 링크" name="invoiceLink" values={values} setValues={setValues} required /><TextArea label="요청 사유" name="matchReason" values={values} setValues={setValues} required /><TextArea label="메모" name="note" values={values} setValues={setValues} /></>;
  return <><Field label="업체명" name="companyName" values={values} setValues={setValues} required /><Field label="월마감 관련 링크" name="monthEndLink" values={values} setValues={setValues} required placeholder="IKI 월마감 또는 Tracking 링크" /><TextArea label="요청 내용" name="note" values={values} setValues={setValues} required /></>;
}

export function RequestKindForm({ kind }: { kind: RequestKind }) {
  const { selectedUser } = useSelectedUser();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FormValues>({});
  const [showRevisionModal, setShowRevisionModal] = useState(kind === "revisedTaxInvoice");
  const [gateBlocked, setGateBlocked] = useState(false);
  const [gateLoading, setGateLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const config = REQUEST_FORM_CONFIGS[kind];
  const stableSetValues = useMemo(() => setValues, []);

  useEffect(() => {
    if (kind === "revisedTaxInvoice") setShowRevisionModal(true);
  }, [kind]);

  useEffect(() => {
    let active = true;
    setGateLoading(true);

    if (selectedUser.accessRole === "admin") {
      setGateBlocked(false);
      setGateLoading(false);
      return () => {
        active = false;
      };
    }

    checkMonthEndGate(selectedUser.name)
      .then((result) => {
        if (active) setGateBlocked(result.isBlocked);
      })
      .catch(() => {
        if (active) setGateBlocked(false);
      })
      .finally(() => {
        if (active) setGateLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedUser.accessRole, selectedUser.name]);

  const submitRequest = async () => {
    const assignedOwners = (values.assignedOwners ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    if (assignedOwners.length === 0) {
      window.alert("VIPS 담당자를 1명 이상 선택해주세요.");
      return;
    }

    const formValues = formRef.current
      ? Object.fromEntries(Array.from(new FormData(formRef.current).entries()).map(([key, value]) => [key, String(value)]))
      : {};
    const requestValues: FormValues = { ...formValues, ...values, assignedOwners: assignedOwners.join(",") };

    try {
      setSaving(true);
      await saveRequest({
        kind,
        values: requestValues as RequestFormValues,
        totalAmount:
          requestValues.invoiceTotalAmount ||
          requestValues.totalAmount ||
          requestValues.depositAmount ||
          requestValues.paymentAmount ||
          requestValues.contractAmount ||
          requestValues.gpAmount ||
          "",
        existingCount: 0,
        requester: selectedUser.email
      });
      window.alert("요청이 접수되었습니다.");
      window.location.href = `/request-status?user=${encodeURIComponent(selectedUser.name)}`;
    } catch {
      window.alert("요청 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (gateLoading) {
    return (
      <div className="mt-6 rounded-[24px] border border-[#e7ecf4] bg-white p-8 text-center shadow-sm">
        <p className="text-[14px] font-[850] text-[#64748b]">월마감 Gatekeeper를 확인하는 중입니다.</p>
      </div>
    );
  }

  if (gateBlocked) {
    return (
      <>
        <div className="mt-6 rounded-[24px] border border-[#F39945]/40 bg-[#fff5ec] p-8 text-center shadow-sm">
          <p className="text-[22px] font-[950] tracking-[-0.03em] text-[#111827]">월마감 미완료로 요청 진입이 제한되었습니다.</p>
          <p className="mt-3 text-[14px] font-[750] leading-6 text-[#64748b]">
            {selectedUser.name}님에게 미종료 거래 또는 관리자 차단 상태가 남아 있습니다. 월마감 체크에서 남은 이슈를 확인한 뒤 요청을 진행해주세요.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={`/month-end?user=${encodeURIComponent(selectedUser.name)}`} className="flex h-11 items-center rounded-xl bg-[#1D50A2] px-5 text-[13px] font-[900] text-white">
              월마감 체크 확인하기
            </Link>
            <Link href={`/requests?user=${encodeURIComponent(selectedUser.name)}`} className="flex h-11 items-center rounded-xl border border-[#dce6f3] bg-white px-5 text-[13px] font-[900] text-[#34496b]">
              요청 메뉴로
            </Link>
          </div>
        </div>
        <BlockedGateDialog open={true} onClose={() => (window.location.href = `/requests?user=${encodeURIComponent(selectedUser.name)}`)} />
      </>
    );
  }

  return (
    <>
      {showRevisionModal && (
        <div data-revision-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b3e]/35 px-4">
          <div className="w-[460px] rounded-[24px] border border-[#e7ecf4] bg-white p-6 shadow-[0_26px_80px_rgba(30,37,52,0.24)]">
            <p className="text-[18px] font-[900] text-[#10203f]">수정세금계산서 요청 전 확인</p>
            <p className="mt-3 text-[13px] font-[650] leading-6 text-[#435a7b]">
              전월 계산서 수정은 월마감 및 부가세 신고 흐름에 영향을 줄 수 있습니다. 수정 가능 여부를 반드시 확인 후 요청해주세요.
            </p>
            <button
              type="button"
              data-revision-confirm="true"
              onClick={() => setShowRevisionModal(false)}
              className="mt-5 h-11 w-full rounded-xl bg-[#1D50A2] text-[13px] font-[900] text-white"
            >
              확인 후 진행
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between rounded-[22px] border border-[#e7ecf4] bg-[#f8fbff] px-5 py-4">
        <Link href="/requests" className="flex items-center gap-2 text-[13px] font-[850] text-[#1f5fe0]">
          <ArrowLeft size={16} />
          요청 메뉴로 돌아가기
        </Link>
        <span className="rounded-full bg-white px-3 py-1 text-[12px] font-[850] text-[#667085]">월마감 미완료자는 모든 VIPS팀 요청 진입이 불가합니다.</span>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_300px] gap-5 max-[980px]:grid-cols-1">
        <form ref={formRef} className="rounded-[24px] border border-[#e7ecf4] bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-[#edf1f6] pb-4">
            <p className="text-[12px] font-[850] uppercase tracking-[0.08em] text-[#1D50A2]">VIPS Request</p>
            <h2 className="mt-1 text-[20px] font-[900] text-[#10203f]">{config.formTitle}</h2>
          </div>
          <AssigneeSelector values={values} setValues={stableSetValues} />
          <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
            <RequestFields kind={kind} values={values} setValues={stableSetValues} />
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-[#edf1f6] pt-5">
            <Link href="/requests" className="flex h-11 items-center rounded-xl border border-[#dce6f3] bg-white px-5 text-[13px] font-[850] text-[#34496b]">
              취소
            </Link>
            <button type="button" onClick={submitRequest} disabled={saving} className="h-11 rounded-xl bg-[#1D50A2] px-6 text-[13px] font-[900] text-white shadow-sm disabled:opacity-55">
              {saving ? "저장 중" : "요청 제출"}
            </button>
          </div>
        </form>
        <OperationNote kind={kind} />
      </div>
    </>
  );
}
