"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { clearDemoSession, isDemoEnvironment, matchDemoCredentials, setDemoSession } from "../../lib/demo-auth";

function safeNext(value: unknown) {
  const next = String(value ?? "").trim();
  return next && next.startsWith("/") && !next.startsWith("//") && next.length <= 2048 ? next : "/dashboard";
}

function textField(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === "string" && value.length <= maxLength ? value : "";
}

function redirectToLogin(error: "credentials" | "invalid") {
  redirect(`/login?error=${error}`);
}

export async function loginAction(formData: FormData) {
  const email = textField(formData, "email", 320).trim().toLowerCase();
  const password = textField(formData, "password", 256);
  const next = safeNext(formData.get("next"));

  if (!email || !password) redirectToLogin("invalid");

  const demoRole = matchDemoCredentials(email, password);
  if (demoRole) {
    await clearDemoSession();
    await setDemoSession(demoRole);
    redirect(demoRole === "platform_admin" ? "/admin" : next);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/login?error=unavailable");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirectToLogin("credentials");

  redirect(next);
}

export async function demoLoginAction(formData: FormData) {
  if (!isDemoEnvironment()) redirect("/login?error=demo_disabled");

  const role = textField(formData, "role", 32);
  if (role !== "platform_admin" && role !== "shop_owner") redirect("/login?error=invalid");

  await setDemoSession(role);
  redirect(role === "platform_admin" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await clearDemoSession();
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login?logged_out=1");
}
