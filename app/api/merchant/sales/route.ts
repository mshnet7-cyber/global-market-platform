import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireMerchantPlan(["pro", "business"]);
    const body = await request.json();
    const storeId = body.store_id ? String(body.store_id) : null;
    const branchId = body.branch_id ? String(body.branch_id) : null;
    const customerId = body.customer_id ? String(body.customer_id) : null;
    const paymentMethod = String(body.payment_method ?? "cash");
    const notes = body.notes ? String(body.notes).slice(0, 2000) : null;
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!storeId || !lines.length) return NextResponse.json({ error: "store_and_lines_required" }, { status: 400 });
    if (!["cash", "bank", "card", "wallet", "mixed", "other"].includes(paymentMethod)) return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });

    const normalized: Array<Record<string, unknown>> = [];
    for (const raw of lines) {
      const productId = String(raw.product_id ?? "");
      const quantity = Number(raw.quantity);
      const weight = Number(raw.weight_grams ?? 0);
      const unitPrice = Number(raw.unit_price ?? 0);
      const makingCharge = Number(raw.making_charge ?? 0);
      const discount = Number(raw.discount_amount ?? 0);
      const vatAmount = Number(raw.vat_amount ?? 0);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(weight) || weight < 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(makingCharge) || makingCharge < 0 || !Number.isFinite(discount) || discount < 0 || !Number.isFinite(vatAmount) || vatAmount < 0) {
        return NextResponse.json({ error: "invalid_sale_line" }, { status: 400 });
      }
      normalized.push({ product_id: productId, quantity, weight_grams: weight, unit_price: unitPrice, making_charge: makingCharge, discount_amount: discount, vat_amount: vatAmount });
    }

    const { data, error } = await supabase.rpc("gmp_create_and_post_sale", {
      p_organization_id: (await requireMerchantPlan(["pro", "business"])).organization.id,
      p_branch_id: branchId,
      p_store_id: storeId,
      p_customer_id: customerId,
      p_payment_method: paymentMethod,
      p_notes: notes,
      p_lines: normalized,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    const status = message === "merchant_plan_required" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
