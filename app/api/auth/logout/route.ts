import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { isLiveAuthEnabled } from "../../../services/authMode";

export async function POST() {
  if (isLiveAuthEnabled()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  return NextResponse.json({ ok: true });
}

