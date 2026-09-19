import { NextResponse } from "next/server";
import { isSameOriginRequest } from "../../../../lib/request-security";
import { getDemoCredentials, setDemoSession, isDemoEnvironment, type DemoRole } from "../../../../lib/demo-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "cross_site_request" }, { status: 403 });
  if (!isDemoEnvironment()) return NextResponse.json({ error: "demo_disabled" }, { status: 404 });

  let role: DemoRole;
  try {
    const body = await request.formData();
    const requested = String(body.get("role") ?? "");
    if (requested !== "platform_admin" && requested !== "shop_owner") {
      return NextResponse.json({ error: "invalid_demo_role" }, { status: 400 });
    }
    role = requested;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await setDemoSession(role);
  const next = role === "platform_admin" ? "/admin" : "/dashboard";
  return NextResponse.redirect(new URL(next, request.url));
}
