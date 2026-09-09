import { NextResponse } from "next/server";
import { getAuthenticatedPortalUser, unauthorized } from "../../../services/authServer";
import { isLiveAuthEnabled } from "../../../services/authMode";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isLiveAuthEnabled()) {
    return NextResponse.json({ mode: "demo" });
  }

  const user = await getAuthenticatedPortalUser();
  if (!user) {
    return unauthorized("로그인은 확인됐지만 등록된 직원 정보가 없습니다. 관리자에게 계정 등록을 요청해주세요.");
  }

  const { authUserId: _authUserId, ...portalUser } = user;
  return NextResponse.json({ mode: "supabase", user: portalUser });
}

