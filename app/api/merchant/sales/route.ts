import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";

function n(value: unknown, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

export async function POST(request: Request) {
  try {
    const { supabase, user, organization } = await requireMerchantPlan(["pro", "business"]);
    const body = await request.json();
    const storeId = String(body.store_id ?? "");
    const branchId = body.branch_id ? String(body.branch_id) : null;
    const paymentMethod = String(body.payment_method ?? "cash");
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!storeId || !lines.length) return NextResponse.json({ error: "store_and_lines_required" }, { status: 400 });
    if (!["cash","bank","card","wallet","mixed","other"].includes(paymentMethod)) return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });

    const { data: store } = await supabase.from("gmp_stores").select("id,organization_id,branch_id,currency").eq("id", storeId).eq("organization_id", organization.id).maybeSingle();
    if (!store) return NextResponse.json({ error: "store_not_found" }, { status: 404 });
    if (branchId && store.branch_id && store.branch_id !== branchId) return NextResponse.json({ error: "branch_store_mismatch" }, { status: 400 });

    let subtotal = 0;
    let vat = 0;
    const normalized: Array<Record<string, unknown>> = [];
    for (const raw of lines) {
      const productId = String(raw.product_id ?? "");
      const quantity = n(raw.quantity);
      const weight = n(raw.weight_grams);
      const unitPrice = n(raw.unit_price);
      const makingCharge = n(raw.making_charge);
      const discount = n(raw.discount_amount);
      const lineVat = n(raw.vat_amount);
      if (!productId || quantity <= 0 || weight < 0 || unitPrice < 0 || makingCharge < 0 || discount < 0 || lineVat < 0) return NextResponse.json({ error: "invalid_sale_line" }, { status: 400 });
      subtotal += quantity * unitPrice + makingCharge - discount;
      vat += lineVat;
      normalized.push({ product_id: productId, quantity, weight_grams: weight, unit_price: unitPrice, making_charge: makingCharge, discount_amount: discount, vat_amount: lineVat });
    }
    const total = subtotal + vat;

    const { data: sale, error: saleError } = await supabase.from("gmp_sales").insert({ organization_id: organization.id, branch_id: branchId ?? store.branch_id, store_id: store.id, status: "issued", subtotal, vat_amount: vat, total, payment_method: paymentMethod, issued_at: new Date().toISOString(), created_by: user.id }).select("id,invoice_no,status,total,currency").maybeSingle();
    if (saleError || !sale) return NextResponse.json({ error: saleError?.message ?? "sale_create_failed" }, { status: 400 });

    const { error: linesError } = await supabase.from("gmp_sale_lines").insert(normalized.map(line => ({ ...line, sale_id: sale.id })));
    if (linesError) {
      await supabase.from("gmp_sales").update({ status: "voided", updated_at: new Date().toISOString() }).eq("id", sale.id).eq("organization_id", organization.id);
      return NextResponse.json({ error: linesError.message, sale_id: sale.id, status: "voided" }, { status: 400 });
    }

    const { data: journalId, error: postError } = await supabase.rpc("gmp_post_sale", { p_organization_id: organization.id, p_branch_id: branchId ?? store.branch_id, p_store_id: store.id, p_sale_id: sale.id, p_payment_method: paymentMethod, p_subtotal: subtotal, p_vat: vat, p_total: total, p_created_by: user.id, p_lines: normalized });
    if (postError || !journalId) {
      await supabase.from("gmp_sales").update({ status: "voided", updated_at: new Date().toISOString() }).eq("id", sale.id).eq("organization_id", organization.id);
      return NextResponse.json({ error: postError?.message ?? "sale_post_failed", sale_id: sale.id, status: "voided" }, { status: 400 });
    }
    return NextResponse.json({ success: true, sale, journal_id: journalId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    const status = message === "merchant_plan_required" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
