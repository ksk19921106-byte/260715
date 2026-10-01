"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileText, Link2, Search, Send, RotateCcw } from "lucide-react";
import { ModulePage } from "../../components/ModulePage";
import { allocationProblem, draftProblem, invoiceAvailable, orderAvailable, type InvoiceDraft, type InvoiceOrder, type WorkflowInvoice } from "../../services/invoiceWorkflow";
import styles from "./workflow.module.css";

const companies = [{ id: "SAMPLE-A", name: "샘플전자", contact: "구매팀", email: "buyer@example.invalid" }, { id: "SAMPLE-B", name: "샘플연구소", contact: "연구지원팀", email: "lab@example.invalid" }];
const initialOrders: InvoiceOrder[] = Array.from({ length: 24 }, (_, i) => ({ id: `SAMPLE-ORDER-${String(i + 1).padStart(3, "0")}`, companyId: i < 20 ? "SAMPLE-A" : "SAMPLE-B", label: `${i < 20 ? "전자부품" : "시험부품"} ${i + 1}`, supply: 100000, vat: 10000, linked: 0 }));
const initialInvoices: WorkflowInvoice[] = [{ id: "SAMPLE-TAX-001", companyId: "SAMPLE-A", total: 1100000, title: "전자부품 선발행", allocations: [] }];
const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
type PreviewRequest = { id: string; draft: InvoiceDraft; total: number; status: "pending" | "issued" | "rejected"; orderIds: string[] };

export default function ErpInvoicePreview() {
  const [tab, setTab] = useState<"request" | "review" | "matching">("request");
  const [mode, setMode] = useState<"orders" | "advance">("orders");
  const [companyId, setCompanyId] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [orders, setOrders] = useState(initialOrders);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [requests, setRequests] = useState<PreviewRequest[]>([]);
  const [title, setTitle] = useState("전자부품 외");
  const [date, setDate] = useState(today);
  const [supply, setSupply] = useState("");
  const [vat, setVat] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [activeInvoice, setActiveInvoice] = useState("SAMPLE-TAX-001");
  const [matchOrder, setMatchOrder] = useState("");
  const [matchAmount, setMatchAmount] = useState("");
  const company = companies.find(row => row.id === companyId);
  const availableOrders = orders.filter(row => row.companyId === companyId && row.linked === 0);
  const visibleOrders = availableOrders.filter(row => `${row.id} ${row.label}`.toLowerCase().includes(orderQuery.toLowerCase()));
  const chosen = orders.filter(row => selected.includes(row.id));
  const total = mode === "orders" ? chosen.reduce((sum, row) => sum + row.supply + row.vat, 0) : Number(supply || 0) + Number(vat || 0);
  const invoice = invoices.find(row => row.id === activeInvoice);
  const candidates = useMemo(() => orders.filter(row => row.companyId === invoice?.companyId && orderAvailable(row) > 0), [orders, invoice]);

  function changeTab(next: typeof tab) { setTab(next); setMessage(""); }
  function selectCompany(id: string) { setCompanyId(id); setSelected([]); setOrderQuery(""); setMessage(""); }
  function requestPreview() {
    const draft: InvoiceDraft = { mode, companyId, orderIds: mode === "orders" ? selected : [], title, date, supply: Number(supply), vat: Number(vat), note };
    const problem = draftProblem(draft, orders);
    if (problem) { setMessage(problem); return; }
    const request: PreviewRequest = { id: `PREVIEW-${requests.length + 1}`, draft, total, orderIds: [...draft.orderIds], status: "pending" };
    setRequests(current => [...current, request]); setSelected([]); setTab("review"); setMessage("샘플 검토 목록에 추가했습니다. 실제 요청은 접수되지 않았습니다.");
  }
  function issuePreview(request: PreviewRequest) {
    if (request.status !== "pending") return;
    const problem = draftProblem(request.draft, orders);
    if (problem) { setMessage(problem); return; }
    const next: WorkflowInvoice = { id: `SAMPLE-ISSUED-${request.id}`, companyId: request.draft.companyId, total: request.total, title: request.draft.title, allocations: [] };
    if (request.draft.mode === "orders") {
      next.allocations = request.orderIds.map(id => ({ orderId: id, amount: orderAvailable(orders.find(row => row.id === id)!) }));
      setOrders(current => current.map(row => request.orderIds.includes(row.id) ? { ...row, linked: row.supply + row.vat } : row));
    }
    setInvoices(current => [...current, next]);
    setRequests(current => current.map(row => row.id === request.id ? { ...row, status: "issued" } : row));
    setActiveInvoice(next.id); setMatchOrder(""); setMatchAmount("");
    setMessage(request.draft.mode === "advance" ? "샘플 발행 완료 · 주문 연결 대기 목록에서 후속 연결을 확인할 수 있습니다." : "샘플 발행 및 선택 주문 연결 완료 · 실제 ERP 반영 없음");
  }
  function matchPreview() {
    if (!invoice) return;
    const amount = Number(matchAmount);
    const problem = allocationProblem(invoice, orders.find(row => row.id === matchOrder), amount);
    if (problem) { setMessage(problem); return; }
    setInvoices(current => current.map(row => row.id === invoice.id ? { ...row, allocations: [...row.allocations, { orderId: matchOrder, amount }] } : row));
    setOrders(current => current.map(row => row.id === matchOrder ? { ...row, linked: row.linked + amount } : row));
    setMatchOrder(""); setMatchAmount(""); setMessage("샘플 주문 연결 반영 · 실제 ERP 반영 없음");
  }
  function reset() {
    if (!window.confirm("샘플 요청과 연결 내역을 초기화할까요?")) return;
    setOrders(initialOrders); setInvoices(initialInvoices); setRequests([]); setSelected([]); setMatchOrder(""); setMatchAmount(""); setActiveInvoice("SAMPLE-TAX-001"); setMessage("");
  }
  return <ModulePage compactMobile eyebrow="ERP Integration Preview" title="세금계산서 요청" description="ERP 연동 미리보기">
    <div className={styles.root}>
      <div className={styles.notice}><span><strong>샘플 데이터 · ERP 미연결</strong> · 실제 접수·발행·매칭 없음 · 새로고침 시 초기화</span><button type="button" onClick={reset} title="샘플 초기화" aria-label="샘플 초기화"><RotateCcw size={17} /></button></div>
      <div className={styles.topline}><Link href="/requests/taxInvoice"><ArrowLeft size={16} />기존 업무 요청</Link><Link href="/login">직원 로그인 화면</Link></div>
      <div role="tablist" aria-label="계산서 업무" className={styles.tabs}>
        {([{ id: "request", label: "발행 요청" }, { id: "review", label: `VIPS 검토 (${requests.filter(row => row.status === "pending").length})` }, { id: "matching", label: `주문 연결 (${invoices.filter(row => invoiceAvailable(row) > 0).length})` }] as const).map(item => <button role="tab" aria-selected={tab === item.id} key={item.id} onClick={() => changeTab(item.id)}>{item.label}</button>)}
      </div>
      {message && <p className={styles.feedback} role="status">{message}</p>}
      {tab === "request" && <div role="tabpanel">
        <div className={styles.modes} role="group" aria-label="발행 방식"><button aria-pressed={mode === "orders"} onClick={() => { setMode("orders"); setMessage(""); }}>기존 주문으로 발행</button><button aria-pressed={mode === "advance"} onClick={() => { setMode("advance"); setSelected([]); setMessage(""); }}>주문 전 선발행</button></div>
        <section className={styles.section}><h2>1. 거래처</h2>
          <label className={styles.search}><Search size={17} /><input aria-label="거래처 검색" placeholder="거래처명 또는 코드 검색" value={companyQuery} onChange={e => setCompanyQuery(e.target.value)} /></label>
          <div className={styles.companyResults}>{companies.filter(row => `${row.name} ${row.id}`.toLowerCase().includes(companyQuery.toLowerCase())).map(row => <button key={row.id} aria-pressed={row.id === companyId} onClick={() => selectCompany(row.id)}><span><strong>{row.name}</strong><small>{row.id}</small></span>{row.id === companyId && <Check size={18} />}</button>)}</div>
          {!companies.some(row => `${row.name} ${row.id}`.toLowerCase().includes(companyQuery.toLowerCase())) && <p className={styles.empty}>검색 결과 없음</p>}
          {company && <dl className={styles.meta}><div><dt>거래처 코드</dt><dd>{company.id}</dd></div><div><dt>수신 담당</dt><dd>{company.contact}</dd></div><div><dt>수신 이메일</dt><dd>{company.email}</dd></div></dl>}
        </section>
        {mode === "orders" && <section className={styles.section}><div className={styles.heading}><h2>2. 발행 대상 주문</h2><span>{selected.length}건 선택 · {won(total)}</span></div>
          <label className={styles.search}><Search size={17} /><input aria-label="주문 검색" placeholder="주문번호 또는 품목" value={orderQuery} onChange={e => setOrderQuery(e.target.value)} /></label>
          <div className={styles.tableWrap}><table><thead><tr><th><input type="checkbox" aria-label="검색된 주문 전체 선택" disabled={!visibleOrders.length} checked={!!visibleOrders.length && visibleOrders.every(row => selected.includes(row.id))} onChange={e => setSelected(current => e.target.checked ? Array.from(new Set([...current, ...visibleOrders.map(row => row.id)])) : current.filter(id => !visibleOrders.some(row => row.id === id)))} /></th><th>주문번호</th><th>품목</th><th>공급가액</th><th>세액</th><th>합계</th></tr></thead><tbody>{visibleOrders.map(row => <tr key={row.id}><td><input aria-label={`${row.id} 선택`} type="checkbox" checked={selected.includes(row.id)} onChange={e => setSelected(current => e.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} /></td><td>{row.id}</td><td>{row.label}</td><td>{won(row.supply)}</td><td>{won(row.vat)}</td><td>{won(row.supply + row.vat)}</td></tr>)}</tbody></table></div>
          {!visibleOrders.length && <p className={styles.empty}>{company ? "발행 가능한 샘플 주문이 없습니다." : "거래처 선택 대기"}</p>}
        </section>}
        <section className={styles.section}><h2>{mode === "orders" ? "3" : "2"}. 계산서 정보</h2><div className={styles.fields}>
          <label>표시 품목명<input value={title} onChange={e => setTitle(e.target.value)} /></label><label>발행 희망일<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          {mode === "advance" && <><label>공급가액 (원)<input type="number" min="1" step="1" value={supply} onChange={e => setSupply(e.target.value)} /></label><label>세액 (원)<input type="number" min="0" step="1" value={vat} onChange={e => setVat(e.target.value)} /></label></>}
          <label className={styles.wide}>요청사항<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
        </div><div className={styles.summary}><span>{mode === "orders" ? `원주문 ${selected.length}건 유지` : "발행 후 주문 연결 대기"}</span><strong>합계 {won(Number.isFinite(total) ? total : 0)}</strong></div></section>
        <div className={styles.actions}><button className={styles.primary} onClick={requestPreview}><Send size={16} />샘플 검토 요청</button></div>
      </div>}
      {tab === "review" && <section role="tabpanel" className={styles.section}><h2>VIPS 검토 · 샘플</h2>{!requests.length && <p className={styles.empty}>검토할 샘플 요청이 없습니다.</p>}{requests.map(request => <article key={request.id} className={styles.request}><div className={styles.heading}><h3><FileText size={18} />{companies.find(row => row.id === request.draft.companyId)?.name} · {request.draft.mode === "advance" ? "선발행" : "주문 발행"}</h3><span>{request.status === "pending" ? "검토대기" : request.status === "issued" ? "샘플 발행됨" : "샘플 반려됨"}</span></div><p>{request.draft.title} · {request.draft.date} · <strong>{won(request.total)}</strong></p><p>{request.draft.note || "요청사항 없음"}</p>
        {request.orderIds.length > 0 ? <details><summary>연결할 원주문 {request.orderIds.length}건</summary><ul>{request.orderIds.map(id => <li key={id}>{id}</li>)}</ul></details> : <p className={styles.pending}>주문 미지정 · 발행 이후 연결 대기</p>}
        {request.status === "pending" && <div className={styles.actions}><button onClick={() => setRequests(current => current.map(row => row.id === request.id ? { ...row, status: "rejected" } : row))}>샘플 반려</button><button className={styles.primary} onClick={() => issuePreview(request)}><Check size={16} />샘플 승인·발행</button></div>}
      </article>)}</section>}
      {tab === "matching" && <section role="tabpanel" className={styles.section}><h2>기존 계산서에 주문 연결</h2><label className={styles.selectLabel}>계산서<select value={activeInvoice} onChange={e => { setActiveInvoice(e.target.value); setMatchOrder(""); setMatchAmount(""); setMessage(""); }}>{invoices.map(row => <option key={row.id} value={row.id}>{row.id} · {row.title} · {invoiceAvailable(row) > 0 ? "연결 대기" : "연결 완료"}</option>)}</select></label>
        {invoice && <><dl className={styles.meta}><div><dt>발행 금액</dt><dd>{won(invoice.total)}</dd></div><div><dt>연결 금액</dt><dd>{won(invoice.total - invoiceAvailable(invoice))}</dd></div><div><dt>미연결 금액</dt><dd className={styles.pending}>{won(invoiceAvailable(invoice))}</dd></div></dl>
          {invoiceAvailable(invoice) > 0 ? <><h3 className={styles.candidateTitle}>같은 거래처의 주문 후보 · 확인 필요</h3><div className={styles.fields}><label>대상 주문<select value={matchOrder} onChange={e => { setMatchOrder(e.target.value); const row = candidates.find(order => order.id === e.target.value); setMatchAmount(row ? String(Math.min(orderAvailable(row), invoiceAvailable(invoice))) : ""); }}><option value="">주문 선택</option>{candidates.map(row => <option value={row.id} key={row.id}>{row.id} · {row.label} · {won(orderAvailable(row))}</option>)}</select></label><label>연결 금액 (원)<input type="number" min="1" step="1" value={matchAmount} onChange={e => setMatchAmount(e.target.value)} /></label></div><div className={styles.actions}><button className={styles.primary} onClick={matchPreview}><Link2 size={16} />샘플 연결 확인</button></div></> : <p className={styles.feedback}>선택된 계산서의 샘플 주문 연결이 완료되었습니다.</p>}
          <h3>연결 내역</h3>{invoice.allocations.length ? <ul className={styles.allocations}>{invoice.allocations.map((row, index) => <li key={`${row.orderId}-${index}`}><span>{row.orderId}</span><strong>{won(row.amount)}</strong></li>)}</ul> : <p className={styles.empty}>연결된 주문 없음</p>}
        </>}
      </section>}
    </div>
  </ModulePage>;
}
