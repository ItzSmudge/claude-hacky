#!/usr/bin/env node
// Reads `supabase status -o json` and writes local Supabase URL/keys into .env.local.
// Leaves every other line (e.g. ANTHROPIC_API_KEY) untouched.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { upsertEnv } from "./lib/upsert-env.mjs";

const ENV_FILE = ".env.local";
if (!existsSync(ENV_FILE)) copyFileSync(".env.example", ENV_FILE);

let status;
try {
  const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  status = JSON.parse(out.slice(out.indexOf("{")));
} catch (err) {
  console.error("❌ Could not read `supabase status`. Is the local stack running? (pnpm db:start)");
  console.error(err.message);
  process.exit(1);
}

const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
};
for (const [k, v] of Object.entries(values)) {
  if (!v) {
    console.error(`❌ supabase status did not report a value for ${k}`);
    process.exit(1);
  }
}

writeFileSync(ENV_FILE, upsertEnv(readFileSync(ENV_FILE, "utf8"), values));
console.log(`✅ Wrote local Supabase values to ${ENV_FILE} (${values.NEXT_PUBLIC_SUPABASE_URL})`);
