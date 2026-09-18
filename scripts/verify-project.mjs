import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const checks = [];
function ok(name, condition, detail = "") {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  checks.push(name);
}
function text(path){ return readFileSync(join(root,path),"utf8"); }

ok("package.json exists", existsSync(join(root,"package.json")));
const pkg = JSON.parse(text("package.json"));
ok("Next is declared", Boolean(pkg.dependencies?.next));
ok("build script exists", typeof pkg.scripts?.build === "string");
ok("lint script exists", typeof pkg.scripts?.lint === "string");
ok("merchant camera API exists", existsSync(join(root,"app/api/merchant/cameras/route.ts")));
ok("merchant compliance API exists", existsSync(join(root,"app/api/merchant/compliance/route.ts")));
ok("merchant invoicing API exists", existsSync(join(root,"app/api/merchant/invoicing/route.ts")));
ok("camera dashboard exists", existsSync(join(root,"app/dashboard/cameras/page.tsx")));
ok("compliance dashboard exists", existsSync(join(root,"app/dashboard/compliance/page.tsx")));
ok("invoicing dashboard exists", existsSync(join(root,"app/dashboard/invoicing/page.tsx")));
ok("document intelligence API exists", existsSync(join(root,"app/api/merchant/documents/route.ts")));
ok("document intelligence dashboard exists", existsSync(join(root,"app/dashboard/documents/page.tsx")));
ok("webhook retry endpoint exists", existsSync(join(root,"app/api/cron/webhooks/route.ts")));
const migrationFiles = execFileSync("git",["ls-files","supabase/migrations"],{encoding:"utf8"}).split("\n").filter(Boolean);
ok("operational workflow migration tracked", migrationFiles.some(x=>x.includes("gmp_full_plan_operational_workflows_v1")));
ok("camera endpoint migration tracked", migrationFiles.some(x=>x.includes("gmp_camera_endpoint_hardening_v1")));
ok("invoicing hardening migration tracked", migrationFiles.some(x=>x.includes("gmp_harden_invoicing_rls_indexes_transitions_v1")));
ok("legacy Sukna execute lockdown tracked", migrationFiles.some(x=>x.includes("gmp_final_revoke_legacy_sukna_authenticated_execute_v1")));
const cameraApi=text("app/api/merchant/cameras/route.ts");
ok("camera API fail-closed", cameraApi.includes("requireMerchantPlan([\"business\"]") && cameraApi.includes("username || url.password"));
ok("camera API does not accept credentialed URL", cameraApi.includes("if (url.username || url.password) return null"));
const invoiceApi=text("app/api/merchant/invoicing/route.ts");
ok("country invoicing is explicit", invoiceApi.includes("OM") && invoiceApi.includes("SA") && invoiceApi.includes("AE"));
ok("government send is fail-closed", invoiceApi.includes("connector.status !== \"active\""));
ok("invoice API enforces transition allowlist", invoiceApi.includes("invalid_submission_transition") && invoiceApi.includes("transitions[current.status]"));
const complianceApi=text("app/api/merchant/compliance/route.ts");
ok("compliance API enforces transition allowlist", complianceApi.includes("invalid_case_transition") && complianceApi.includes("transitions[current.status]"));
const ci=text(".github/workflows/ci.yml");
ok("CI runs tests", ci.includes("npm test"));
ok("CI runs lint", ci.includes("npm run lint"));
ok("CI runs build", ci.includes("npm run build"));
const hardening=text("supabase/migrations/20260919000000_gmp_p0_p1_hardening.sql");
ok("marketplace abuse protection tracked", hardening.includes("gmp_public_order_rate_limits") && hardening.includes("gmp_allow_public_marketplace_order"));
ok("webhook retry hardening tracked", hardening.includes("gmp_claim_due_webhook_deliveries") && hardening.includes("dead_lettered"));
console.log(`verify-project: ${checks.length} checks passed`);
