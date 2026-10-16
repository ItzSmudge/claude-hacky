import "server-only";

import { AiConfigError, BriefInputError } from "@/lib/ai/errors";

// Owner: projects (PR-01). Storage keys and error mapping for the brief context route.

/** Whole `<random>-<name>` key segment, so long filenames can't make huge object keys. */
const MAX_KEY = 100;

/** `<projectId>/<random>-<safe name>`; the `briefs` bucket policies key off the first folder. */
export function briefStoragePath(projectId: string, filename: string, random: string): string {
  const name = filename.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const extension = /\.([a-z0-9]+)$/.exec(name)?.[1];
  const stem = (extension ? name.slice(0, -extension.length - 1) : name)
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[.-]{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  const suffix = extension ? `.${extension}` : "";
  const room = MAX_KEY - random.length - 1 - suffix.length;
  return `${projectId}/${random}-${(stem || "brief").slice(0, room)}${suffix}`;
}

/** BriefInputError → 400 with its (student-safe) message; missing key → 503; the rest → 502. */
export function contextErrorStatus(error: unknown): { status: 400 | 502 | 503; message: string } {
  if (error instanceof BriefInputError) return { status: 400, message: error.message };
  if (error instanceof AiConfigError) {
    return { status: 503, message: "Brief reading isn't set up on this server." };
  }
  return { status: 502, message: "Couldn't read that right now." };
}
