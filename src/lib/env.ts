import { z } from "zod";

/**
 * The only place that reads process.env. Import `clientEnv` anywhere, `serverEnv()` only in
 * server code (route handlers, server components, lib/ai, lib/scholar).
 * Shape is documented in .env.example.
 */

// Treat "" as unset so blank lines in .env files behave like missing vars.
const blank = (v: unknown) => (v === "" ? undefined : v);
const str = () => z.preprocess(blank, z.string());
const optStr = () => z.preprocess(blank, z.string().optional());
const flag = (fallback: boolean) =>
  z.preprocess((v) => (blank(v) === undefined ? fallback : v === "true" || v === "1"), z.boolean());

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.preprocess(blank, z.string().default("PaperCut")),
  NEXT_PUBLIC_SITE_URL: z.preprocess(blank, z.url().default("http://localhost:3000")),
  NEXT_PUBLIC_APP_BASE_PATH: z.preprocess(blank, z.string().startsWith("/").default("/app")),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(blank, z.url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: str(),
  NEXT_PUBLIC_FEATURE_GROUPS: flag(true),
  NEXT_PUBLIC_FEATURE_ADAPTIVE: flag(true),
  NEXT_PUBLIC_FEATURE_VOICE: flag(false),
  // Read aloud uses ElevenLabs via /api/tts when on; the device voice otherwise (and on failure).
  NEXT_PUBLIC_FEATURE_ELEVENLABS: flag(false),
});

const serverSchema = clientSchema.extend({
  APP_ENV: z.preprocess(blank, z.enum(["development", "production"]).default("development")),
  SUPABASE_SERVICE_ROLE_KEY: optStr(),
  ANTHROPIC_API_KEY: optStr(),
  ANTHROPIC_MODEL_FAST: z.preprocess(blank, z.string().default("claude-haiku-5-5")),
  ANTHROPIC_MODEL_SMART: z.preprocess(blank, z.string().default("claude-sonnet-5-5")),
  OPENALEX_MAILTO: optStr(),
  SEMANTIC_SCHOLAR_API_KEY: optStr(),
  CROSSREF_MAILTO: optStr(),
  ELEVENLABS_API_KEY: optStr(),
  ELEVENLABS_VOICE_ID: z.preprocess(blank, z.string().default("bGnz83yTAb7caZSC7BBz")),
  ELEVENLABS_MODEL_ID: z.preprocess(blank, z.string().default("eleven_flash_v2_5")),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T extends z.ZodType>(schema: T, source: Record<string, unknown>, label: string) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`);
    throw new Error(
      `❌ Invalid ${label} environment variables:\n${lines.join("\n")}\n` +
        `Check .env.local against .env.example (run \`pnpm bootstrap\` for local Supabase values).`,
    );
  }
  return result.data as z.infer<T>;
}

// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them into client bundles.
const clientSource = {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_APP_BASE_PATH: process.env.NEXT_PUBLIC_APP_BASE_PATH,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_FEATURE_GROUPS: process.env.NEXT_PUBLIC_FEATURE_GROUPS,
  NEXT_PUBLIC_FEATURE_ADAPTIVE: process.env.NEXT_PUBLIC_FEATURE_ADAPTIVE,
  NEXT_PUBLIC_FEATURE_VOICE: process.env.NEXT_PUBLIC_FEATURE_VOICE,
  NEXT_PUBLIC_FEATURE_ELEVENLABS: process.env.NEXT_PUBLIC_FEATURE_ELEVENLABS,
};

export const clientEnv: ClientEnv = parse(clientSchema, clientSource, "client");

let cachedServerEnv: ServerEnv | undefined;
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser — use clientEnv instead.");
  }
  cachedServerEnv ??= parse(serverSchema, { ...process.env, ...clientSource }, "server");
  return cachedServerEnv;
}

/** Throws a readable error when a server-only secret is needed but missing. */
export function requireServerVar<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = serverEnv()[key];
  if (value === undefined || value === null) {
    throw new Error(`❌ ${String(key)} is not set. Add it to .env.local (see .env.example).`);
  }
  return value as NonNullable<ServerEnv[K]>;
}
