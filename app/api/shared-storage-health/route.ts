import { NextResponse } from "next/server";
import { debugSharedStorageConnection } from "../../services/sharedStorageServer";
import { isLiveAuthEnabled } from "../../services/authMode";
import { forbidden, getAuthenticatedPortalUser, isVipsUser, unauthorized } from "../../services/authServer";

export const runtime = "nodejs";

export async function GET() {
  const authUser = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled() && !authUser) return unauthorized();
  if (authUser && !isVipsUser(authUser)) return forbidden();
  const result = await debugSharedStorageConnection("requests");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
