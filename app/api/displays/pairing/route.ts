import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const makeCode = () => crypto.randomInt(0, 1000000).toString().padStart(6, "0");

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return new NextResponse("Display pairing is not configured.", { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/display", request.url));
  const form = await request.formData();
  const screenId = String(form.get("screen_id") ?? "");
  const { data: screen } = await supabase.from("gmp_screens").select("id,store_id").eq("id", screenId).maybeSingle();
  if (!screen) return NextResponse.redirect(new URL("/display?error=screen", request.url));
  const { data: store } = await supabase.from("gmp_stores").select("id,organization_id").eq("id", screen.store_id).maybeSingle();
  const { data: org } = store ? await supabase.from("gmp_organizations").select("id").eq("id", store.organization_id).eq("owner_id", user.id).maybeSingle() : { data: null };
  if (!org) return NextResponse.redirect(new URL("/display?error=forbidden", request.url));
  await admin.from("gmp_screen_pairing_codes").update({ consumed_at: new Date().toISOString() }).eq("screen_id", screenId).is("consumed_at", null);
  const plain = makeCode();
  const { error } = await admin.from("gmp_screen_pairing_codes").insert({ screen_id: screenId, code_hash: sha256(plain), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  if (error) return NextResponse.redirect(new URL("/display?error=pairing", request.url));
  await admin.from("gmp_screens").update({ status: "pairing", updated_at: new Date().toISOString() }).eq("id", screenId);
  return NextResponse.redirect(new URL(`/display?screen=${screenId}&code=${plain}`, request.url));
}
