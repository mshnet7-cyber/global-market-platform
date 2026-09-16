import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";

const MAX_SALE_LINES = 100;
const PAYMENT_METHODS = new Set(["cash", "bank", "card", "wallet", "other"]);

export async function POST(request: Request) {
  try {
    const { supabase, organization } = await requireMerchantPlan(["pro", "business"]);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    const storeId = body.store_id ? String(body.store_id) : null;
    const branchId = body.branch_id ? String(body.branch_id) : null;
    const customerId = body.customer_id ? String(body.customer_id) : null;
    const paymentMethod = String(body.payment_method ?? "cash");
    const notes = body.notes ? String(body.notes).slice(0, 2000) : null;
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!storeId || !lines.length) return NextResponse.json({ error: "store_and_lines_required" }, { status: 400 });
    if (lines.length > MAX_SALE_LINES) return NextResponse.json({ error: "too_many_sale_lines" }, { status: 400 });
    if (!PAYMENT_METHODS.has(paymentMethod)) return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });

    const normalized: Array<Record<string, unknown>> = [];
    for (const raw of lines) {
      if (!raw || typeof raw !== "object") return NextResponse.json({ error: "invalid_sale_line" }, { status: 400 });
      const item = raw as Record<string, unknown>;
      const productId = String(item.product_id ?? "");
      const quantity = Number(item.quantity);
      const weight = Number(item.weight_grams ?? 0);
      const unitPrice = Number(item.unit_price ?? 0);
      const makingCharge = Number(item.making_charge ?? 0);
      const discount = Number(item.discount_amount ?? 0);
      const vatAmount = Number(item.vat_amount ?? 0);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(weight) || weight < 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(makingCharge) || makingCharge < 0 || !Number.isFinite(discount) || discount < 0 || !Number.isFinite(vatAmount) || vatAmount < 0) {
        return NextResponse.json({ error: "invalid_sale_line" }, { status: 400 });
      }
      if (discount > (quantity * unitPrice) + makingCharge) return NextResponse.json({ error: "discount_exceeds_line_amount" }, { status: 400 });
      normalized.push({ product_id: productId, quantity, weight_grams: weight, unit_price: unitPrice, making_charge: makingCharge, discount_amount: discount, vat_amount: vatAmount });
    }

    const { data, error } = await supabase.rpc("gmp_create_and_post_sale", {
      p_organization_id: organization.id,
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
