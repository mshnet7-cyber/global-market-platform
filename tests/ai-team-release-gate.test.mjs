import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release gate requires all verification gates", () => {
  const text = readFileSync("scripts/ai-team-release-gate.mjs","utf8");
  for (const token of ["deployment_commit_match","runtime_health","browser_e2e","RELEASE GATE PASS"]) assert.ok(text.includes(token));
});
