import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("demo login is preview-only, role-bound, origin-checked, and body-bounded", () => {
  const route = read("app/api/auth/demo-login/route.ts");
  const auth = read("lib/demo-auth.ts");
  assert.match(auth, /VERCEL_ENV === "preview"/);
  assert.doesNotMatch(auth, /DEMO_MODE === "true"/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /isDemoEnvironment/);
  assert.match(route, /readBoundedRequestFormData/);
  assert.match(route, /16 \* 1024/);
  assert.match(route, /request_body_too_large/);
  assert.match(route, /platform_admin/);
  assert.match(route, /shop_owner/);
  assert.match(route, /setDemoSession/);
  assert.ok(route.indexOf("isSameOriginRequest(request)") < route.indexOf("readBoundedRequestFormData"));
  assert.ok(route.indexOf("isDemoEnvironment()") < route.indexOf("setDemoSession"));
});

test("normal login keeps demo credentials ahead of Supabase password auth", () => {
  const route = read("app/api/auth/login/route.ts");
  assert.match(route, /matchDemoCredentials/);
  assert.ok(route.indexOf("matchDemoCredentials") < route.indexOf("signInWithPassword"));
  assert.match(route, /demoRole === "platform_admin"/);
  assert.match(route, /setDemoSession/);
});

test("logout checks request origin before changing session state", () => {
  const route = read("app/api/auth/logout/route.ts");
  const guard = route.indexOf("isSameOriginRequest(request)");
  const clear = route.indexOf("clearDemoSession()");
  const signOut = route.indexOf("supabase.auth.signOut()");
  assert.ok(guard >= 0);
  assert.ok(clear > guard);
  assert.ok(signOut > clear);
});
