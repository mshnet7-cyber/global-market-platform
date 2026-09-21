#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const file = ".ai-team/evidence.json";
if (!existsSync(file)) {
  console.error("[AI TEAM RELEASE] BLOCK: evidence file is missing.");
  process.exit(2);
}
const evidence = JSON.parse(readFileSync(file, "utf8"));
const required = ["test","lint","build","verify","policy"];
const missing = required.filter(k => !evidence.results?.[k] || evidence.results[k].status !== "pass");
for (const key of missing) console.error("[AI TEAM RELEASE] BLOCK:", key, "gate is not PASS");
if (evidence.deployment?.status !== "pass") console.error("[AI TEAM RELEASE] BLOCK: deployment_commit_match is not PASS");
if (evidence.runtime?.status !== "pass") console.error("[AI TEAM RELEASE] BLOCK: runtime_health is not PASS");
if (evidence.browserE2E?.status !== "pass") console.error("[AI TEAM RELEASE] BLOCK: browser_e2e is not PASS");
if (missing.length || evidence.deployment?.status !== "pass" || evidence.runtime?.status !== "pass" || evidence.browserE2E?.status !== "pass") process.exit(2);
console.log("[AI TEAM RELEASE] RELEASE GATE PASS");
