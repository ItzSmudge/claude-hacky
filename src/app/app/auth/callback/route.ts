import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: projects (PR-03). Google OAuth lands here with a PKCE code; swap it for a session cookie.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/app";
  // Same-origin paths only, so the callback can't be used as an open redirect.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("[auth] code exchange failed", error.status, error.message);
  } else {
    console.error("[auth] callback without code", url.searchParams.get("error_description"));
  }
  return NextResponse.redirect(new URL("/app?auth=failed", url.origin));
}
