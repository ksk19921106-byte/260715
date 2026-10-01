import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { mustChangePassword } from "./app/services/accountPolicy";

function liveAuthEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_OPS_AUTH_MODE === "supabase" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_OPS_AUTH_MODE === "supabase" && !liveAuthEnabled()) {
    return NextResponse.json({ message: "로그인 설정이 준비되지 않았습니다. 관리자에게 문의해주세요." }, { status: 503 });
  }
  if (!liveAuthEnabled()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicPath = pathname === "/login" || pathname.startsWith("/auth/");

  if (!data.user && !isPublicPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (data.user && !isPublicPath) {
    const { data: profile, error } = await supabase.from("portal_profiles")
      .select("active").eq("email", (data.user.email || "").toLowerCase()).eq("active", true).maybeSingle();
    if ((error || !profile) && pathname !== "/api/auth/logout") {
      return NextResponse.json({ message: "등록된 활성 직원 계정이 아닙니다. 관리자에게 문의해주세요." }, { status: 403 });
    }
    const allowed = ["/account/password", "/api/auth/password", "/api/auth/logout"];
    if (mustChangePassword(data.user.app_metadata) && !allowed.includes(pathname)) {
      const result = pathname.startsWith("/api/")
        ? NextResponse.json({ message: "초기 비밀번호를 먼저 변경해주세요.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 })
        : NextResponse.redirect(new URL("/account/password?required=1", request.url));
      response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
      return result;
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"]
};
