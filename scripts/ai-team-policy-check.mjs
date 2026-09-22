#!/usr/bin/env node
import { execFileSync } from "node:child_process";
const base = process.env.AI_TEAM_BASE_REF || process.env.GITHUB_BASE_REF || "HEAD^";
const head = process.env.AI_TEAM_HEAD_REF || "HEAD";
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
let changed;
try { changed = git(["diff","--name-only",base + "..." + head]).split("\n").filter(Boolean); }
catch { changed = git(["diff","--name-only","HEAD^","HEAD"]).split("\n").filter(Boolean); }
const protectedPatterns = [
  /(^|\/)(supabase|migrations)(\/|$)/,
  /(^|\/).*rpc/i, /(^|\/).*auth/i, /(^|\/).*rls/i,
  /gold[-_ ]?(engine|ledger|price|buyback|exchange)/i,
  /account(ing)?/i, /tax/i, /invoice/i, /inventory/i, /tenant/i
];
const sensitive = changed.filter(file => protectedPatterns.some(re => re.test(file)));
const tests = changed.filter(file => /(^|\/)(test|tests)(\/|$)|\.test\./i.test(file));
console.log("[AI TEAM POLICY]");
console.log("base:", base, "head:", head, "changed files:", changed.length);
if (sensitive.length) {
  console.log("protected-domain files:");
  for (const file of sensitive) console.log("  -", file);
  if (!tests.length) {
    console.error("POLICY BLOCK: protected-domain changes require at least one changed test.");
    process.exit(2);
  }
  console.log("test evidence files:", tests.length);
} else console.log("protected-domain changes: none detected");
console.log("POLICY PASS");
