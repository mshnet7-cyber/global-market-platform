import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("AI team config defines fail-closed lifecycle and protected domains", () => {
  const config = JSON.parse(readFileSync("config/ai-team.json","utf8"));
  assert.equal(config.fail_closed,true);
  assert.ok(config.workflow.includes("impact-classification"));
  assert.ok(config.workflow.includes("runtime"));
  assert.ok(config.protected_domains.includes("pricing"));
  assert.ok(config.protected_domains.includes("rls"));
});
