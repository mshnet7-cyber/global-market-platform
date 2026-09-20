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
  assert.match(actions, /matchDemoCredentials/);
  assert.ok(actions.indexOf("const demoRole = matchDemoCredentials") < actions.indexOf("setDemoSession"));
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

test("logout checks request origin before changing session state", () => {
  const route = read("app/api/auth/logout/route.ts");
  const guard = route.indexOf("if (!isSameOriginRequest(request))");
  const clear = route.indexOf("clearDemoSession()");
  const signOut = route.indexOf("supabase.auth.signOut()");
  assert.ok(guard >= 0);
  assert.ok(clear > guard);
  assert.ok(signOut > clear);
});
