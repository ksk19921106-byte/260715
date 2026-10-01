import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { safeAccountNext } from "../../services/accountPolicy";

function safeNext(value: string | null) {
  return safeAccountNext(value);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();

  let error: Error | null = null;
  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    error = result.error;
  } else {
    error = new Error("로그인 인증 정보가 없습니다.");
  }

  if (error) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "callback");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
