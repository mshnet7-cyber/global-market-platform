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
const migrationFiles = execFileSync("git",["ls-files","supabase/migrations"],{encoding:"utf8"}).split("\n").filter(Boolean);
ok("operational workflow migration tracked", migrationFiles.some(x=>x.includes("gmp_full_plan_operational_workflows_v1")));
ok("camera endpoint migration tracked", migrationFiles.some(x=>x.includes("gmp_camera_endpoint_hardening_v1")));
const cameraApi=text("app/api/merchant/cameras/route.ts");
ok("camera API fail-closed", cameraApi.includes("requireMerchantPlan([\"business\"]") && cameraApi.includes("username || url.password"));
ok("camera API does not accept credentialed URL", cameraApi.includes("if (url.username || url.password) return null"));
const invoiceApi=text("app/api/merchant/invoicing/route.ts");
ok("country invoicing is explicit", invoiceApi.includes("OM") && invoiceApi.includes("SA") && invoiceApi.includes("AE"));
ok("government send is fail-closed", invoiceApi.includes("connector.status !== \"active\""));
const ci=text(".github/workflows/ci.yml");
ok("CI runs lint", ci.includes("npm run lint"));
ok("CI runs build", ci.includes("npm run build"));
console.log(`verify-project: ${checks.length} checks passed`);
