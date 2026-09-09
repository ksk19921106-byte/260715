export type OpsAuthMode = "demo" | "supabase";

export function getOpsAuthMode(): OpsAuthMode {
  return process.env.NEXT_PUBLIC_OPS_AUTH_MODE === "supabase" ? "supabase" : "demo";
}

export function isSupabaseAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function isLiveAuthEnabled() {
  return getOpsAuthMode() === "supabase" && isSupabaseAuthConfigured();
}

