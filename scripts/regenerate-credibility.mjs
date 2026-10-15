#!/usr/bin/env node
// Recomputes `credibility` for every fixture paper with src/lib/credibility.ts (SE-04).
// Run after changing the formula: node scripts/regenerate-credibility.mjs && node scripts/generate-seed.mjs
// `now` is fixed so fixtures (and the test that checks them) stay stable as the calendar moves on.
import { readFileSync, writeFileSync } from "node:fs";
import { computeCredibility } from "../src/lib/credibility.ts";

const FILE = "src/fixtures/papers.json";
const NOW = new Date("2026-10-15T12:00:00Z");

const fixture = JSON.parse(readFileSync(FILE, "utf8"));
for (const entry of fixture.papers) {
  entry.credibility = computeCredibility(entry.paper, { now: NOW });
}
fixture._comment = fixture._comment.replace(
  "Credibility here is a placeholder formula until SE-04 lands.",
  "Credibility is computed by src/lib/credibility.ts (scripts/regenerate-credibility.mjs).",
);
writeFileSync(FILE, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`✓ recomputed credibility for ${fixture.papers.length} fixture papers`);
