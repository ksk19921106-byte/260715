import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../../lib/supabase/server";
import { isLiveAuthEnabled } from "../../../services/authMode";
import { passwordProblem } from "../../../services/accountPolicy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const reply = (message: string, status: number) => NextResponse.json({ message }, { status });
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply("허용되지 않은 요청입니다.", 403);
  if (!isLiveAuthEnabled() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return reply("비밀번호 변경 연결이 준비되지 않았습니다. 관리자에게 문의해주세요.", 503);
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) return reply("로그인이 필요합니다.", 401);
    const { data: profile } = await supabase.from("portal_profiles").select("active")
      .eq("email", user.email.toLowerCase()).eq("active", true).maybeSingle();
    if (!profile) return reply("활성 직원 계정이 아닙니다.", 403);
    const body = await request.json();
    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    const problem = passwordProblem(current, next);
    if (problem) return reply(problem, 400);

    // Reauthenticate in an isolated client; never replace the browser's session here.
    const verifier = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const verified = await verifier.auth.signInWithPassword({ email: user.email, password: current });
    if (verified.error || verified.data.user?.id !== user.id) return reply("현재 비밀번호를 확인해주세요. 반복 실패 시 잠시 후 다시 시도해주세요.", 400);
    await verifier.auth.signOut({ scope: "local" });
    const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password: next,
      app_metadata: { ...user.app_metadata, portal_password_initialized: true, portal_password_reset_required: false }
    });
    if (updated.error) return reply("비밀번호를 변경하지 못했습니다. 비밀번호 정책을 확인하거나 관리자에게 문의해주세요.", 400);
    await supabase.auth.signOut({ scope: "global" });
    return reply("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.", 200);
  } catch {
    return reply("처리 결과를 확인하지 못했습니다. 새 비밀번호로 로그인을 확인한 후 관리자에게 문의해주세요.", 500);
  }
}
