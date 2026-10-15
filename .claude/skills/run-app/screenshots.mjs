#!/usr/bin/env node
// Screenshot every PaperCut page at phone size, light + dark, signed in as the demo user.
// usage: node .claude/skills/run-app/screenshots.mjs [outDir] [baseUrl]
// Needs: `pnpm db:start` (local Supabase) and `pnpm dev` already running.
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const OUT = path.resolve(process.argv[2] ?? "screenshots");
const BASE = process.argv[3] ?? "http://localhost:3000";
const PROJECT = "00000000-0000-4000-8000-000000000001"; // seeded demo project

// Playwright is not a project dependency; use the project's copy if present, else the global one.
function loadPlaywright() {
  for (const from of [process.cwd() + "/", execSync("npm root -g").toString().trim() + "/"]) {
    try {
      return createRequire(from)("playwright");
    } catch {}
  }
  throw new Error("playwright not found — install it globally (npm i -g playwright)");
}
const { chromium, devices } = loadPlaywright();

// Local Supabase URL + anon key come from the CLI, never from .env files.
let status;
try {
  status = execSync("pnpm exec supabase status -o env", { stdio: ["ignore", "pipe", "ignore"] });
} catch {
  console.error(
    "Local Supabase isn't running — start Docker, then `pnpm db:start` (see SKILL.md).",
  );
  process.exit(2);
}
const env = Object.fromEntries(
  status
    .toString()
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

// Sign in as the demo user and hand the session to the browser as the @supabase/ssr cookie.
const res = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: env.ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ email: "demo@papercut.local", password: "papercut-demo" }),
});
const session = await res.json();
if (!session.access_token) throw new Error(`demo login failed (${res.status}) — run pnpm db:reset`);
const cookieName = `sb-${new URL(env.API_URL).hostname.split(".")[0]}-auth-token`;
const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const chunks = value.match(/.{1,3180}/g);
const cookies = (
  chunks.length === 1 ? [[cookieName, value]] : chunks.map((c, i) => [`${cookieName}.${i}`, c])
).map(([name, v]) => ({ name, value: v, domain: new URL(BASE).hostname, path: "/" }));

// [name, path, fullPage]. The deck has a fixed action bar, so it is shot at viewport size.
const ROUTES = [
  ["01-marketing", "/", true],
  ["02-app-home", "/app", true],
  ["03-join", "/app/join/DEMO42", true],
  ["04-swipe-deck", `/app/p/${PROJECT}`, false],
  ["05-library", `/app/p/${PROJECT}/library`, true],
  ["06-styleguide", "/app/_styleguide", true],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failed = false;
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    colorScheme: scheme,
    reducedMotion: "reduce",
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const [name, route, fullPage] of ROUTES) {
    errors.length = 0;
    const response = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60_000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }); // dev badge
    await page.waitForTimeout(800);
    const file = path.join(OUT, `${name}-${scheme}.png`);
    await page.screenshot({ path: file, fullPage });
    const status = response?.status() ?? 0;
    if (status >= 400 || errors.length) failed = true;
    console.log(
      `${status} ${scheme.padEnd(5)} ${route} → ${file}${errors.length ? `\n  errors: ${errors.slice(0, 3).join(" | ")}` : ""}`,
    );
  }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
