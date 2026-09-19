import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("demo login route is preview-only, role-bound, origin-checked, and body-bounded", () => {
  const route = read("app/api/auth/demo-login/route.ts");
  const auth = read("lib/demo-auth.ts");
  assert.match(auth, /VERCEL_ENV === "preview"/);
  assert.doesNotMatch(auth, /DEMO_MODE === "true"/);
  assert.match(route, /if \(!isSameOriginRequest\(request\)\)/);
  assert.match(route, /if \(!isDemoEnvironment\(\)\)/);
  assert.match(route, /readBoundedRequestFormData/);
  assert.match(route, /16 \* 1024/);
  assert.match(route, /request_body_too_large/);
  assert.match(route, /platform_admin/);
  assert.match(route, /shop_owner/);
  assert.match(route, /setDemoSession/);
  assert.ok(route.indexOf("if (!isSameOriginRequest(request))") < route.indexOf("readBoundedRequestFormData(request"));
  assert.ok(route.indexOf("if (!isDemoEnvironment())") < route.indexOf("setDemoSession(role)"));
});

test("login server action is bound to safe redirect targets and both auth modes", () => {
  const action = read("app/login/actions.ts");
  assert.match(action, /"use server"/);
  assert.match(action, /matchDemoCredentials/);
  assert.match(action, /signInWithPassword/);
  assert.match(action, /demoRole === "platform_admin"/);
  assert.match(action, /startsWith\("\/"\)/);
  assert.match(action, /!next\.startsWith\("\/\/"\)/);
  assert.match(action, /next\.length <= 2048/);
  assert.match(action, /formData\.get\("email"\)/);
  assert.match(action, /formData\.get\("password"\)/);
  assert.match(action, /maxLength/);
  assert.match(action, /redirect\(/);
});

test("public login page invokes server actions instead of protected auth route handlers", () => {
  const page = read("app/login/page.tsx");
  assert.match(page, /import \{ demoLoginAction, loginAction \} from "\.\/actions"/);
  assert.match(page, /action=\{loginAction\}/);
  assert.match(page, /action=\{demoLoginAction\}/);
  assert.doesNotMatch(page, /action="\/api\/auth\/login"/);
  assert.doesNotMatch(page, /action="\/api\/auth\/demo-login"/);
});

test("normal login keeps demo credentials ahead of Supabase password auth", () => {
  const route = read("app/api/auth/login/route.ts");
  assert.match(route, /matchDemoCredentials/);
  assert.ok(route.indexOf("const demoRole = matchDemoCredentials") < route.indexOf("signInWithPassword"));
  assert.match(route, /demoRole === "platform_admin"/);
  assert.match(route, /setDemoSession/);
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
