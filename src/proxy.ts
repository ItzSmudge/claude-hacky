import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only the app and API need a session; marketing pages stay static.
  matcher: ["/app/:path*", "/api/:path*"],
};
