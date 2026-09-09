"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { createClient } from "../lib/supabase/client";
import { getOpsAuthMode } from "../services/authMode";

function nextPath() {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("next");
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const isDemo = getOpsAuthMode() !== "supabase";

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      window.location.replace(nextPath());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email.trim()) {
      setMessage("회사 이메일을 먼저 입력해주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
      });
      if (error) throw error;
      setMessage("로그인 링크를 보냈습니다. 회사 메일함을 확인해주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인 링크를 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (isDemo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eaf3ff] px-6">
        <section className="w-full max-w-md rounded-[24px] border border-[#cddcf1] bg-white p-8 text-center shadow-[0_18px_48px_rgba(29,80,162,0.12)]">
          <h1 className="text-2xl font-bold text-[#10264a]">현재는 시연 모드입니다</h1>
          <p className="mt-3 text-sm leading-6 text-[#61718a]">실제 이메일 로그인을 사용하려면 Vercel 환경변수에서 인증 모드를 켜주세요.</p>
          <a href="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#1D50A2] px-5 text-sm font-semibold text-white">포털로 돌아가기</a>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#eaf3ff] px-6 py-10">
      <section className="grid w-full max-w-[920px] overflow-hidden rounded-[28px] border border-[#cddcf1] bg-white shadow-[0_24px_70px_rgba(29,80,162,0.16)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between bg-[#1D50A2] p-8 text-white md:p-10">
          <div>
            <div className="relative h-10 w-40 rounded-xl bg-white px-3 py-2">
              <Image src="/assets/brand/icbanq-logo-en.png" alt="ICBANQ" fill sizes="160px" className="object-contain p-2" />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">OPS Portal</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight">업무를 시작하려면<br />회사 계정으로 로그인하세요.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">로그인한 직원의 팀과 직책에 따라 월마감, 수금, 요청 데이터가 자동으로 제한됩니다.</p>
          </div>
          <p className="mt-10 text-xs text-white/55">ICBANQ 사내 사용자 전용</p>
        </div>

        <div className="p-8 md:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#1D50A2]">
            <LockKeyhole size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-bold text-[#10264a]">로그인</h2>
          <p className="mt-2 text-sm text-[#61718a]">관리자가 등록한 회사 이메일만 사용할 수 있습니다.</p>

          <form onSubmit={signIn} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#304562]">회사 이메일</span>
              <span className="flex h-12 items-center gap-3 rounded-xl border border-[#cddcf1] bg-white px-4 focus-within:border-[#1D50A2] focus-within:ring-2 focus-within:ring-[#1D50A2]/10">
                <Mail size={18} className="text-[#70829d]" />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@icbanq.com" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#304562]">비밀번호</span>
              <span className="flex h-12 items-center gap-3 rounded-xl border border-[#cddcf1] bg-white px-4 focus-within:border-[#1D50A2] focus-within:ring-2 focus-within:ring-[#1D50A2]/10">
                <LockKeyhole size={18} className="text-[#70829d]" />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="비밀번호를 입력하세요" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </span>
            </label>

            <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#1D50A2] text-sm font-semibold text-white transition hover:bg-[#173f82] disabled:cursor-wait disabled:opacity-60">
              {loading ? "확인 중..." : "로그인"}
            </button>
          </form>

          <button type="button" onClick={sendMagicLink} disabled={loading} className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-[#cddcf1] bg-white text-sm font-semibold text-[#1D50A2] transition hover:bg-[#f5f8fc] disabled:opacity-60">
            비밀번호 없이 이메일 링크 받기
          </button>

          {message ? <p className="mt-4 rounded-xl bg-[#f5f8fc] px-4 py-3 text-sm leading-5 text-[#465a76]">{message}</p> : null}
          <p className="mt-6 text-xs leading-5 text-[#8290a5]">로그인 문제가 있으면 VIPS 담당자에게 계정 등록 여부를 확인해주세요.</p>
        </div>
      </section>
    </main>
  );
}

