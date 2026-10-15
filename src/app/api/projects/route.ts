import { notImplemented } from "@/lib/http/not-implemented";

// Owner: projects (PR-01, PR-02)
export async function GET(_request: Request) {
  return notImplemented("PR-02");
}

export async function POST(_request: Request) {
  return notImplemented("PR-01");
}
