import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";
import { AiConfigError } from "./errors";
import { generateJson, type JsonRequest, type JsonResult } from "./json";

/** "fast" = ANTHROPIC_MODEL_FAST (per-paper work), "smart" = ANTHROPIC_MODEL_SMART (briefs, relations). */
export type ModelTier = "fast" | "smart";

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = serverEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiConfigError(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  // The SDK retries 408/409/429/5xx, timeouts and connection errors with backoff.
  client = new Anthropic({ apiKey });
  return client;
}

/** Per-attempt timeout and retries; worst case ≈ (maxRetries + 1) × timeout, doubled by a repair. */
const LIMITS: Record<ModelTier, { timeout: number; maxRetries: number }> = {
  fast: { timeout: 60_000, maxRetries: 2 },
  smart: { timeout: 120_000, maxRetries: 2 },
};

export function modelFor(tier: ModelTier): string {
  const env = serverEnv();
  return tier === "smart" ? env.ANTHROPIC_MODEL_SMART : env.ANTHROPIC_MODEL_FAST;
}

/**
 * Ask Claude for JSON matching `schema`: validated data, or a rejected promise with
 * AiConfigError / AiRefusalError / AiOutputError (or the SDK's typed API errors after retries).
 */
export async function askJson<T>({
  tier,
  ...request
}: JsonRequest<T> & { tier: ModelTier }): Promise<JsonResult<T>> {
  return generateJson(getClient(), modelFor(tier), { ...LIMITS[tier], ...request });
}
