import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("AI team guardrails define protected-domain policy", () => {
  const text = readFileSync("scripts/ai-team-policy-check.mjs","utf8");
  assert.match(text,/protectedPatterns/);
  assert.match(text,/POLICY BLOCK/);
  assert.match(text,/tests/);
});

test("AI team evidence records deployment and runtime as independent gates", () => {
  const text = readFileSync("scripts/ai-team-evidence.mjs","utf8");
  assert.match(text,/deployment_commit_match/);
  assert.match(text,/runtime_health/);
  assert.match(text,/browser_e2e/);
});
