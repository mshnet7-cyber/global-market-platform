import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("demo access is preview-only and requires server-side credential matching", () => {
  const auth = read("lib/demo-auth.ts");
  const actions = read("app/login/actions.ts");
  const page = read("app/login/page.tsx");
  assert.match(auth, /VERCEL_ENV === "preview"/);
  assert.doesNotMatch(auth, /DEMO_MODE === "true"/);
  assert.match(auth, /gmp_demo_session/);
  assert.match(auth, /GMP_DEMO_SESSION_SECRET/);
  assert.match(auth, /crypto\.subtle\.sign/);
  assert.match(auth, /crypto\.subtle\.verify/);
  assert.match(auth, /verifyRoleSignature/);
  assert.match(actions, /matchDemoCredentials/);
  const demoMatch = actions.indexOf("const demoRole = matchDemoCredentials");
  const demoSession = actions.indexOf("await setDemoSession(demoRole)");
  assert.ok(demoMatch >= 0 && demoSession > demoMatch);
  assert.doesNotMatch(actions, /demoLoginAction/);
  assert.doesNotMatch(page, /demoLoginAction/);
  assert.doesNotMatch(page, /action="\/api\/auth\/demo-login"/);
});

test("login server action is bound to safe redirect targets and both auth modes", () => {
  const action = read("app/login/actions.ts");
  assert.match(action, /"use server"/);
  assert.match(action, /matchDemoCredentials/);
  assert.match(action, /signInWithPassword/);
  assert.match(action, /demoRole\s*===\s*"platform_admin"/);
  assert.match(action, /startsWith\("\/"\)/);
  assert.match(action, /!next\.startsWith\("\/\/"\)/);
  assert.match(action, /next\.length <= 2048/);
  assert.match(action, /textField\(formData, "email", 320\)/);
  assert.match(action, /textField\(formData, "password", 256\)/);
  assert.match(action, /maxLength/);
  assert.match(action, /redirect\(/);
});

test("public login page uses the credential-checked server action", () => {
  const page = read("app/login/page.tsx");
  assert.match(page, /import \{ loginAction \} from "\.\/actions"/);
  assert.match(page, /action=\{loginAction\}/);
  assert.doesNotMatch(page, /demoLoginAction/);
  assert.doesNotMatch(page, /action="\/api\/auth\/demo-login"/);
});

test("normal login keeps demo credentials ahead of Supabase password auth", () => {
  const route = read("app/api/auth/login/route.ts");
  assert.match(route, /matchDemoCredentials/);
  assert.ok(route.indexOf("const demoRole = matchDemoCredentials") < route.indexOf("signInWithPassword"));
  assert.match(route, /demoRole === "platform_admin"/);
  assert.match(route, /setDemoSession/);
});

test("preview demo role cannot be trusted without an HMAC signature", () => {
  const auth = read("lib/demo-auth.ts");
  const session = auth.indexOf("getDemoSession");
  const verify = auth.indexOf("verifyRoleSignature");
  assert.ok(session >= 0);
  assert.ok(verify >= 0);
  assert.ok(verify < session + 1000);
  assert.match(auth, /roleValue/);
  assert.match(auth, /signature/);
  assert.match(auth, /crypto\.subtle\.verify/);
});

test("state-changing admin and merchant APIs reject cross-site requests", () => {
  const admin = read("app/api/admin/overview/route.ts");
  const stage2 = read("app/api/stage2/route.ts");
  assert.match(admin, /isSameOriginRequest/);
  assert.ok(admin.indexOf("isSameOriginRequest(request)") < admin.indexOf("const \{supabase,admin,user\}=await guard"));
  assert.match(stage2, /isSameOriginRequest/);
  assert.match(stage2, /action !== "marketplace_order"/);
  assert.match(stage2, /cross_site_request/);
});

test("logout checks request origin before changing session state", () => {
  const route = read("app/api/auth/logout/route.ts");
  const guard = route.indexOf("if (!isSameOriginRequest(request))");
  const clear = route.indexOf("clearDemoSession()");
  const signOut = route.indexOf("supabase.auth.signOut()");
  assert.ok(guard >= 0);
  assert.ok(clear > guard);
  assert.ok(signOut > clear);
});
