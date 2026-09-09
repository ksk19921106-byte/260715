import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "../lib/supabase/server";
import { isLiveAuthEnabled } from "./authMode";
import type { PortalUser } from "./portalUsers";
import { getOperationsScope, isSalesNameInScope } from "./organization";

type PortalProfileRow = {
  email: string;
  name: string;
  korean_name: string | null;
  sales_name: string;
  team: string;
  role: "SALES" | "VIPS";
  access_role: "admin" | "manager" | "sales";
  active: boolean;
};

export type AuthenticatedPortalUser = PortalUser & {
  authUserId: string;
};

function profileToUser(profile: PortalProfileRow, authUserId: string): AuthenticatedPortalUser {
  return {
    authUserId,
    name: profile.name,
    email: profile.email,
    team: profile.team,
    role: profile.role,
    accessRole: profile.access_role,
    salesName: profile.sales_name,
    koreanName: profile.korean_name || undefined
  };
}

export async function getAuthenticatedPortalUser(): Promise<AuthenticatedPortalUser | null> {
  if (!isLiveAuthEnabled()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const authUser = data.user;
  if (error || !authUser?.email) return null;

  const { data: profile } = await supabase
    .from("portal_profiles")
    .select("email,name,korean_name,sales_name,team,role,access_role,active")
    .eq("email", authUser.email.toLowerCase())
    .eq("active", true)
    .maybeSingle<PortalProfileRow>();

  return profile ? profileToUser(profile, authUser.id) : null;
}

export function unauthorized(message = "로그인이 필요합니다.") {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbidden(message = "이 데이터에 접근할 권한이 없습니다.") {
  return NextResponse.json({ message }, { status: 403 });
}

export function isVipsUser(user: PortalUser | null | undefined) {
  return user?.role === "VIPS" || user?.accessRole === "admin";
}

export function canViewSalesName(user: PortalUser, salesName: string | null | undefined) {
  if (isVipsUser(user)) return true;
  const target = String(salesName ?? "").trim();
  if (!target) return false;
  const scope = getOperationsScope(user);
  return scope.canViewOperations
    ? isSalesNameInScope(target, scope)
    : target.toLowerCase() === user.salesName.toLowerCase();
}
