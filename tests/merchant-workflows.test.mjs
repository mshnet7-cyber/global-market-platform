import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("camera workflow is business-gated and credential-safe",()=>{
 const src=read("app/api/merchant/cameras/route.ts");
 assert.match(src,/requireMerchantPlan\(\["business"\]\)/);
 assert.match(src,/url\.username \|\| url\.password/);
 assert.match(src,/endpoint_secret_ref/);
 assert.doesNotMatch(src,/select\("[^\n]*endpoint_secret_ref/);
});

test("compliance workflow has duplicate protection and event idempotency",()=>{
 const src=read("app/api/merchant/compliance/route.ts");
 assert.match(src,/active_case_exists/);
 assert.match(src,/idempotency_key/);
 assert.match(src,/requireMerchantPlan\(\["business"\]\)/);
});

test("e-invoice queue is fail-closed",()=>{
 const src=read("app/api/merchant/invoicing/route.ts"); assert.match(src,/gmp_claim_einvoice_send/);
 assert.match(src,/sale\.status !== "issued"/);
 assert.match(src,/connector\.status !== "active"/);
 assert.match(src,/idempotency_key/);
 assert.match(src,/organization_id[\s,]+idempotency_key/); assert.match(src,/idempotent:true/); assert.match(src,/\.insert\(/); assert.doesNotMatch(src,/gmp_einvoice_submissions[^\n]*\.upsert/);
});

test("dashboard exposes all three business workflows",()=>{
 const src=read("app/dashboard/page.tsx");
 assert.match(src,/\/dashboard\/cameras/);
 assert.match(src,/\/dashboard\/compliance/);
 assert.match(src,/\/dashboard\/invoicing/);
});

test("database migration enforces workflow transitions",()=>{
 const src=read("supabase/migrations/20260916224000_gmp_workflow_transition_integrity_v1.sql");
 assert.match(src,/gmp_check_camera_scope/);
 assert.match(src,/gmp_check_compliance_case_transition/);
 assert.match(src,/gmp_check_einvoice_transition/);
 assert.match(src,/gmp_compliance_case_transition_check/);
 assert.match(src,/gmp_einvoice_transition_check/);
});
