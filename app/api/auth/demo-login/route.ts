import { NextResponse } from "next/server";
import { isSameOriginRequest } from "../../../../lib/request-security";
import { readBoundedRequestFormData } from "../../../../lib/bounded-body";
import { setDemoSession, isDemoEnvironment, type DemoRole } from "../../../../lib/demo-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "cross_site_request" }, { status: 403 });
  if (!isDemoEnvironment()) return NextResponse.json({ error: "demo_disabled" }, { status: 404 });

  let body: FormData;
  try {
    body = await readBoundedRequestFormData(request, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "request_body_too_large";
    return NextResponse.json(
      { error: tooLarge ? "request_body_too_large" : "invalid_request" },
      { status: tooLarge ? 413 : 400 }
    );
  }

  const requested = String(body.get("role") ?? "");
  if (requested !== "platform_admin" && requested !== "shop_owner") {
    return NextResponse.json({ error: "invalid_demo_role" }, { status: 400 });
  }

  const role = requested as DemoRole;
  await setDemoSession(role);
  const next = role === "platform_admin" ? "/admin" : "/dashboard";
  return NextResponse.redirect(new URL(next, request.url));
}
