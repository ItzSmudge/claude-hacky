import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type {
  BetaMessage,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaUsage,
} from "@anthropic-ai/sdk/resources/beta/messages";
import type { z } from "zod";
import { AiOutputError, AiRefusalError } from "./errors";

/**
 * JSON-only requests to Claude with zod validation and one repair retry (AI-01).
 * The client is injected so this is testable without a network or key; `client.ts` wires the
 * real one. Transient HTTP failures (408/409/429/5xx, network) are retried by the SDK itself.
 */

/** The slice of the SDK client this module uses. */
export type AiClient = Pick<Anthropic, "beta">;

export interface JsonRequest<T> {
  /** The contract: the reply must parse as JSON and pass this schema (incl. refinements). */
  schema: z.ZodType<T>;
  /** Stable instructions/context; put per-call input in `messages`. */
  system: string | BetaTextBlockParam[];
  messages: BetaMessageParam[];
  maxTokens?: number;
  /** Omit to use the model's default (Haiku 5.5: medium, Sonnet 5.5: high). */
  effort?: "low" | "medium" | "high";
  /** Prompt-cache the system prompt, e.g. project context reused across many papers. */
  cacheSystem?: boolean;
  signal?: AbortSignal;
}

export interface JsonUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface JsonResult<T> {
  data: T;
  model: string;
  /** True when the first reply failed validation and the repair succeeded. */
  repaired: boolean;
  usage: JsonUsage;
}

const DEFAULT_MAX_TOKENS = 16_000;

// Models that accept server-side refusal fallback (`fallbacks: "default"`). Haiku has none.
const FALLBACK_MODELS = new Set([
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-1",
]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function systemParam(
  system: JsonRequest<unknown>["system"],
  cache: boolean | undefined,
): JsonRequest<unknown>["system"] {
  if (!cache) return system;
  const blocks: BetaTextBlockParam[] =
    typeof system === "string" ? [{ type: "text", text: system }] : [...system];
  const last = blocks.at(-1);
  if (last) blocks[blocks.length - 1] = { ...last, cache_control: { type: "ephemeral" } };
  return blocks;
}

type Attempt<T> = { ok: true; data: T } | { ok: false; text: string; issues: string[] };

/** Throws on refusal/truncation; otherwise parses and validates the reply's text. */
function check<T>(message: BetaMessage, schema: z.ZodType<T>): Attempt<T> {
  if (message.stop_reason === "refusal") {
    throw new AiRefusalError(
      message.stop_details?.category ?? null,
      message.stop_details?.explanation ?? null,
    );
  }
  if (message.stop_reason === "max_tokens") throw new AiOutputError("truncated");

  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, text, issues: [`Your reply was not valid JSON (${reason}).`] };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issues = parsed.error.issues.map((i) =>
    i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
  );
  return { ok: false, text, issues };
}

function addUsage(total: JsonUsage, usage: BetaUsage) {
  total.input_tokens += usage.input_tokens;
  total.output_tokens += usage.output_tokens;
  total.cache_read_input_tokens += usage.cache_read_input_tokens ?? 0;
  total.cache_creation_input_tokens += usage.cache_creation_input_tokens ?? 0;
}

export async function generateJson<T>(
  client: AiClient,
  model: string,
  request: JsonRequest<T>,
): Promise<JsonResult<T>> {
  const fallback = FALLBACK_MODELS.has(model);
  const base = {
    model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: systemParam(request.system, request.cacheSystem),
    output_config: {
      format: betaZodOutputFormat(request.schema),
      ...(request.effort ? { effort: request.effort } : {}),
    },
    ...(fallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
  };
  const usage: JsonUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
  const send = async (messages: BetaMessageParam[]) => {
    const message = await client.beta.messages.create(
      { ...base, messages },
      { signal: request.signal },
    );
    addUsage(usage, message.usage);
    return message;
  };

  const first = await send(request.messages);
  const firstTry = check(first, request.schema);
  if (firstTry.ok) return { data: firstTry.data, model: first.model, repaired: false, usage };

  // One repair: show the model its own reply and exactly what failed.
  const second = await send([
    ...request.messages,
    { role: "assistant", content: firstTry.text || "(no output)" },
    {
      role: "user",
      content:
        "Your previous reply did not match the required JSON schema:\n" +
        firstTry.issues.map((issue) => `- ${issue}`).join("\n") +
        "\nReturn the corrected JSON only.",
    },
  ]);
  const secondTry = check(second, request.schema);
  if (secondTry.ok) return { data: secondTry.data, model: second.model, repaired: true, usage };
  throw new AiOutputError("invalid", secondTry.issues);
}
