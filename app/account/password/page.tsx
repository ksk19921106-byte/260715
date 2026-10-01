"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { passwordProblem } from "../../services/accountPolicy";
import { isLiveAuthEnabled } from "../../services/authMode";

export default function PasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = passwordProblem(current, next) || (next !== confirmation ? "새 비밀번호가 일치하지 않습니다." : null);
    if (problem) { setMessage(problem); return; }
    setBusy(true); setMessage("");
    try {
      const result = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      const body = await result.json();
      setMessage(body.message);
      if (result.ok) { setDone(true); setCurrent(""); setNext(""); setConfirmation(""); }
    } catch { setMessage("연결을 확인할 수 없습니다. 변경 결과를 확인한 뒤 다시 시도해주세요."); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f3f6fa] p-5">
    <section className="w-full max-w-[450px] rounded-lg border border-[#dce3eb] bg-white p-7 shadow-sm">
      <KeyRound size={26} className="text-[#1d50a2]" /><h1 className="mt-4 text-2xl font-bold">비밀번호 변경</h1>
      <p className="mt-3 text-sm leading-6 text-[#627185]">영문과 숫자를 포함한 12~128자<br />초기 비밀번호는 변경 후 포털을 이용할 수 있습니다.</p>
      {!isLiveAuthEnabled() && <p className="mt-3 text-sm text-amber-800">시연 모드 · 실제 비밀번호 변경 불가</p>}
      {!done && <form onSubmit={submit} className="mt-6 space-y-4">
        {([{ label: "현재 비밀번호", value: current, set: setCurrent, auto: "current-password" }, { label: "새 비밀번호", value: next, set: setNext, auto: "new-password" }, { label: "새 비밀번호 확인", value: confirmation, set: setConfirmation, auto: "new-password" }]).map(field => <label key={field.label} className="block text-sm font-semibold">{field.label}<input aria-label={field.label} autoComplete={field.auto} type="password" required maxLength={128} value={field.value} onChange={e => field.set(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#ccd6e2] px-3" /></label>)}
        <button disabled={busy || !isLiveAuthEnabled()} className="h-11 w-full rounded-lg bg-[#1d50a2] font-semibold text-white disabled:opacity-50">{busy ? "변경 중" : "비밀번호 변경"}</button>
      </form>}
      {message && <p role="status" className="mt-4 text-sm leading-6">{message}</p>}
      {done ? <a href="/login" className="mt-5 inline-block font-semibold text-[#1d50a2]">새 비밀번호로 로그인</a> : <a href="/" className="mt-5 inline-block text-sm text-[#627185]">포털로 돌아가기</a>}
      {!done && isLiveAuthEnabled() && <button type="button" disabled={busy} className="ml-5 text-sm text-[#627185]" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.replace("/login"); }}>로그아웃</button>}
    </section>
  </main>;
}
