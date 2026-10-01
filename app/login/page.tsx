"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { LockKeyhole, UserRound } from "lucide-react";
import { createClient } from "../lib/supabase/client";
import { getOpsAuthMode, isSupabaseAuthConfigured } from "../services/authMode";
import { loginEmail, mustChangePassword, safeAccountNext } from "../services/accountPolicy";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const demo = getOpsAuthMode() === "demo";
  const enabled = !demo && isSupabaseAuthConfigured();
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = loginEmail(name);
    if (!email) { setMessage("등록된 영어이름을 입력해주세요."); return; }
    if (!enabled) return;
    setLoading(true); setMessage("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) { setMessage("영어이름과 비밀번호를 확인해주세요."); return; }
      const { data: profile } = await supabase.from("portal_profiles").select("active")
        .eq("email", email).eq("active", true).maybeSingle();
      if (!profile) {
        await supabase.auth.signOut();
        setMessage("활성 직원 계정이 아닙니다. 관리자에게 문의해주세요."); return;
      }
      window.location.replace(mustChangePassword(data.user.app_metadata)
        ? "/account/password?required=1"
        : safeAccountNext(new URLSearchParams(window.location.search).get("next")));
    } catch { setMessage("로그인 연결을 확인할 수 없습니다. 잠시 후 다시 시도해주세요."); }
    finally { setLoading(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f3f6fa] px-5 py-10">
    <section className="w-full max-w-[430px] rounded-lg border border-[#dce3eb] bg-white p-7 shadow-sm">
      <Image src="/assets/brand/icbanq-logo-en.png" alt="ICBANQ" width={158} height={40} className="h-10 w-auto object-contain" priority />
      <h1 className="mt-7 text-2xl font-bold text-[#172a44]">Sales 운영 포털</h1>
      <p className="mt-2 text-sm text-[#58677a]">직원 로그인</p>
      {!enabled && <p role="status" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{demo ? "시연 모드 · 실제 계정 인증 미연결" : "계정 인증 설정을 확인해주세요."}</p>}
      <form onSubmit={signIn} className="mt-6 space-y-5">
        <label className="block text-sm font-semibold">영어이름
          <span className="mt-2 flex items-center gap-3 rounded-lg border border-[#ccd6e2] px-3"><UserRound size={18} className="text-[#66778d]" />
            <input aria-label="영어이름" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={name} onChange={e => setName(e.target.value)} placeholder="예: Sally" className="h-12 min-w-0 flex-1 bg-transparent outline-none" />
          </span>
        </label>
        <label className="block text-sm font-semibold">비밀번호
          <span className="mt-2 flex items-center gap-3 rounded-lg border border-[#ccd6e2] px-3"><LockKeyhole size={18} className="text-[#66778d]" />
            <input aria-label="비밀번호" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="h-12 min-w-0 flex-1 bg-transparent outline-none" />
          </span>
        </label>
        <button disabled={loading || !enabled} className="h-12 w-full rounded-lg bg-[#1d50a2] font-semibold text-white disabled:opacity-50">{loading ? "로그인 중" : "로그인"}</button>
      </form>
      {message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}
      <p className="mt-5 text-xs leading-5 text-[#627185]">최초 로그인에는 초기 비밀번호 변경이 필요합니다.<br />비밀번호를 잊으셨다면 계정 관리자에게 초기화를 요청해주세요.</p>
      {demo && <a href="/" className="mt-5 inline-block text-sm font-semibold text-[#1d50a2]">시연 포털로 돌아가기</a>}
    </section>
  </main>;
}
