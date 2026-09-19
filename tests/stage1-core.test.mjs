import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("stage1 core files exist",()=>{
  for(const path of [
    "lib/gold-pricing.ts","lib/market-trust.ts","lib/market-history.ts","lib/alerts.ts","lib/api-keys.ts","lib/webhooks.ts",
    "app/markets/page.tsx","app/markets/MarketTerminal.tsx","app/gold/page.tsx","app/gold/GoldIntelligence.tsx",
    "app/api/market/terminal/route.ts","app/api/gold/history/route.ts","app/api/alerts/rules/route.ts",
    "app/api/v1/gold/route.ts","app/api/v1/markets/route.ts","app/api/v1/keys/route.ts","app/api/v1/webhooks/route.ts","app/api/health/market/route.ts",
    "supabase/migrations/20260918000000_gmp_market_core_stage1.sql"
  ]) assert.equal(existsSync(path),true,path);
});

test("pricing engine isolates market, weight, purity, workmanship, wastage, spread and tax",()=>{
  const src=read("lib/gold-pricing.ts");
  for(const token of ["marketPerGram24k","weightGrams","karat","makingPerGram","wastagePercent","spreadPerGram","taxRate","direction","roundingIncrement"]) assert.match(src,new RegExp(token));
});

test("trust layer fails closed",()=>{
  const src=read("lib/market-trust.ts");
  assert.match(src,/future_timestamp/);
  assert.match(src,/expired/);
  assert.match(src,/trusted: false/);
  assert.match(src,/ESTIMATED/);
});

test("external API requires authentication and rate limiting",()=>{
  assert.match(read("lib/api-keys.ts"),/api_key_required/);
  assert.match(read("lib/api-keys.ts"),/gmp_consume_api_rate_limit/);
  assert.match(read("app/api/v1/gold/route.ts"),/market:read/);
  assert.match(read("app/api/v1/markets/route.ts"),/market:read/);
});

test("alerts and webhooks have audit/security boundaries",()=>{
  assert.match(read("app/api/alerts/rules/route.ts"),/recordAuditEvent/);
  assert.match(read("app/api/v1/webhooks/route.ts"),/encryptWebhookSecret/); assert.match(read("app/api/v1/webhooks/route.ts"),/validateWebhookUrl/); assert.match(read("app/api/v1/webhooks/route.ts"),/EVENT_TYPES/);
  assert.match(read("lib/webhooks.ts"),/aes-256-gcm/);
});

test("existing public market page is superseded by a focused terminal",()=>{
  assert.match(read("app/markets/page.tsx"),/MarketTerminal/);
  assert.match(read("app/gold/page.tsx"),/GoldIntelligence/);
});


test("auth state-changing routes enforce same-origin requests",()=>{
 for (const path of ["app/api/auth/login/route.ts","app/api/auth/signup/route.ts","app/api/auth/logout/route.ts"]) {
  const src=read(path); assert.match(src,/isSameOriginRequest/); assert.match(src,/cross_site_request/);
 }
});

test("security headers are defined once with no conflicting duplicate policy blocks",()=>{
 const src=read("next.config.ts");
 assert.equal(src.split('source: "/(.*)"').length - 1, 1);
 assert.match(src,/X-Content-Type-Options/);
 assert.match(src,/X-Frame-Options/);
 assert.match(src,/Permissions-Policy/);
});
