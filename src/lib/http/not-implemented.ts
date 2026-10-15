import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/api-schemas";

/** Shared 501 for route placeholders (F-13); each workstream replaces its own handler. */
export function notImplemented(task: string) {
  return NextResponse.json<ApiError>({ error: `Not implemented yet (${task})` }, { status: 501 });
}
