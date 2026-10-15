import { notImplemented } from "@/lib/http/not-implemented";

// Owner: export (LB-02, LB-03)
export async function GET(_request: Request, _ctx: RouteContext<"/api/export/[projectId]">) {
  return notImplemented("LB-03");
}
