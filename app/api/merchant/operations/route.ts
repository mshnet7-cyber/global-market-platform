import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";

const plans: Record<string, ("pro" | "business")[]> = {
  purchases: ["pro", "business"], expenses: ["pro", "business"], repairs: ["business"], "buy-gold": ["business"], inventory: ["business"], accounting: ["pro", "business"], tax: ["business"],
};

const allowedMethods = new Set(["cash", "bank", "card", "wallet", "other"]);
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : null; };

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const module = url.searchParams.get("module") ?? "";
    const access = plans[module];
    if (!access) return NextResponse.json({ error: "invalid_module" }, { status: 404 });
    const { supabase, organization } = await requireMerchantPlan(access);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 100);
    if (module === "accounting") {
      const [{ data: accounts }, { data: entries }] = await Promise.all([
        supabase.from("gmp_accounts").select("id,code,name,account_type,system_key,active").eq("organization_id", organization.id).order("code"),
        supabase.from("gmp_journal_entries").select("id,entry_no,description,entry_date,reference_type,reference_id,status,created_at").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(limit),
      ]);
      return NextResponse.json({ accounts: accounts ?? [], entries: entries ?? [] });
    }
    if (module === "tax") {
      const from = url.searchParams.get("from") ?? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
      const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
      const [{ data: sales }, { data: expenses }] = await Promise.all([
        supabase.from("gmp_sales").select("id,invoice_no,subtotal,vat_amount,total,issued_at,status").eq("organization_id", organization.id).gte("issued_at", `${from}T00:00:00.000Z`).lte("issued_at", `${to}T23:59:59.999Z`).neq("status", "voided"),
        supabase.from("gmp_expenses").select("id,category,amount,vat_amount,expense_date").eq("organization_id", organization.id).gte("expense_date", from).lte("expense_date", to),
      ]);
      const outputVat = (sales ?? []).reduce((s, x) => s + Number(x.vat_amount ?? 0), 0);
      const inputVat = (expenses ?? []).reduce((s, x) => s + Number(x.vat_amount ?? 0), 0);
      const salesTotal = (sales ?? []).reduce((s, x) => s + Number(x.total ?? 0), 0);
      const expensesTotal = (expenses ?? []).reduce((s, x) => s + Number(x.amount ?? 0), 0);
      return NextResponse.json({ from, to, sales: sales ?? [], expenses: expenses ?? [], summary: { output_vat: outputVat, input_vat: inputVat, net_vat: outputVat - inputVat, sales_total: salesTotal, expenses_total: expensesTotal } });
    }
    const table: Record<string, string> = { purchases: "gmp_purchases", expenses: "gmp_expenses", repairs: "gmp_repair_orders", "buy-gold": "gmp_person_gold_purchases", inventory: "gmp_products" };
    const { data, error } = await supabase.from(table[module]).select("*").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ rows: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const module = String(body.module ?? "");
    const access = plans[module];
    if (!access) return NextResponse.json({ error: "invalid_module" }, { status: 404 });
    const { supabase, user, organization } = await requireMerchantPlan(access);
    if (module === "expenses") {
      const category = String(body.category ?? "").trim();
      const amount = num(body.amount);
      const vatAmount = num(body.vat_amount ?? 0);
      if (!category || amount === null || amount <= 0 || vatAmount === null || vatAmount < 0) return NextResponse.json({ error: "invalid_expense" }, { status: 400 });
      const { data, error } = await supabase.from("gmp_expenses").insert({ organization_id: organization.id, branch_id: body.branch_id || null, category: category.slice(0, 120), description: body.description ? String(body.description).slice(0, 1000) : null, amount, vat_amount: vatAmount, expense_date: body.expense_date || undefined, created_by: user.id }).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, row: data }, { status: 201 });
    }
    if (module === "repairs") {
      const description = String(body.item_description ?? "").trim();
      const weight = num(body.weight_received_grams);
      if (!description || weight === null || weight < 0) return NextResponse.json({ error: "invalid_repair" }, { status: 400 });
      const { data, error } = await supabase.from("gmp_repair_orders").insert({ organization_id: organization.id, branch_id: body.branch_id || null, customer_id: body.customer_id || null, item_description: description.slice(0, 500), metal: body.metal ? String(body.metal).slice(0, 40) : null, karat: body.karat ? String(body.karat).slice(0, 20) : null, weight_received_grams: weight, damage_description: body.damage_description ? String(body.damage_description).slice(0, 1000) : null, repair_type: body.repair_type ? String(body.repair_type).slice(0, 120) : null, expected_days: num(body.expected_days), amount: num(body.amount) ?? 0, notes: body.notes ? String(body.notes).slice(0, 1000) : null, created_by: user.id }).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, row: data }, { status: 201 });
    }
    if (module === "buy-gold") {
      const name = String(body.seller_name ?? "").trim();
      const phone = String(body.seller_phone ?? "").trim();
      const identity = String(body.identity_document_path ?? "").trim();
      const weight = num(body.weight_grams); const price = num(body.purchase_price);
      if (!name || !phone || !identity || weight === null || weight <= 0 || price === null || price <= 0) return NextResponse.json({ error: "invalid_person_gold_purchase" }, { status: 400 });
      const { data, error } = await supabase.from("gmp_person_gold_purchases").insert({ organization_id: organization.id, branch_id: body.branch_id || null, seller_name: name.slice(0, 200), seller_phone: phone.slice(0, 40), identity_document_path: identity.slice(0, 1000), item_description: body.item_description ? String(body.item_description).slice(0, 500) : null, karat: body.karat ? String(body.karat).slice(0, 20) : null, weight_grams: weight, market_reference_price: num(body.market_reference_price), purchase_price: price, payment_method: allowedMethods.has(String(body.payment_method)) ? String(body.payment_method) : "cash", created_by: user.id }).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, row: data }, { status: 201 });
    }
    if (module === "inventory") {
      const action = String(body.action ?? "create");
      if (action === "create") {
        const name = String(body.name ?? "").trim(); const storeId = String(body.store_id ?? ""); const price = num(body.price ?? 0);
        if (!name || !storeId || price === null || price < 0) return NextResponse.json({ error: "invalid_product" }, { status: 400 });
        const { data: store } = await supabase.from("gmp_stores").select("id").eq("id", storeId).eq("organization_id", organization.id).maybeSingle();
        if (!store) return NextResponse.json({ error: "store_not_found" }, { status: 404 });
        const { data, error } = await supabase.from("gmp_products").insert({ store_id: storeId, name: name.slice(0, 200), sku: body.sku ? String(body.sku).slice(0, 80) : null, barcode: body.barcode ? String(body.barcode).slice(0, 80) : null, category: body.category ? String(body.category).slice(0, 100) : null, karat: body.karat ? String(body.karat).slice(0, 20) : null, weight_grams: num(body.weight_grams), price, cost_price: num(body.cost_price ?? 0) ?? 0, making_charge: num(body.making_charge ?? 0) ?? 0, current_quantity: num(body.current_quantity ?? 0) ?? 0, current_weight_grams: num(body.current_weight_grams ?? 0) ?? 0, active: true }).select("*").single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true, row: data }, { status: 201 });
      }
      if (action === "adjust") {
        const productId = String(body.product_id ?? ""); const qty = num(body.quantity_delta); const weight = num(body.weight_delta ?? 0); const unitCost = num(body.unit_cost ?? 0);
        if (!productId || qty === null || weight === null || unitCost === null || !Number.isFinite(qty) || !Number.isFinite(weight) || !Number.isFinite(unitCost)) return NextResponse.json({ error: "invalid_inventory_adjustment" }, { status: 400 });
        const { data: product } = await supabase.from("gmp_products").select("id,store_id,current_quantity,current_weight_grams").eq("id", productId).maybeSingle();
        if (!product) return NextResponse.json({ error: "product_not_found" }, { status: 404 });
        const { data: store } = await supabase.from("gmp_stores").select("id,branch_id").eq("id", product.store_id).eq("organization_id", organization.id).maybeSingle();
        if (!store) return NextResponse.json({ error: "product_not_in_organization" }, { status: 403 });
        if (Number(product.current_quantity) + qty < 0 || Number(product.current_weight_grams) + weight < 0) return NextResponse.json({ error: "inventory_would_be_negative" }, { status: 400 });
        const { error: updateError } = await supabase.from("gmp_products").update({ current_quantity: Number(product.current_quantity) + qty, current_weight_grams: Number(product.current_weight_grams) + weight, updated_at: new Date().toISOString() }).eq("id", productId);
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
        const { error: movementError } = await supabase.from("gmp_inventory_movements").insert({ organization_id: organization.id, branch_id: store.branch_id, store_id: store.id, product_id: productId, movement_type: body.movement_type ? String(body.movement_type).slice(0, 40) : "adjustment", quantity: qty, weight_grams: weight, unit_cost: unitCost, reference_type: "manual_adjustment", created_by: user.id });
        if (movementError) return NextResponse.json({ error: movementError.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }
    }
    if (module === "purchases") {
      const storeId = String(body.store_id ?? ""); const lines = Array.isArray(body.lines) ? body.lines : [];
      if (!storeId || !lines.length) return NextResponse.json({ error: "store_and_lines_required" }, { status: 400 });
      let subtotal = 0; let vat = 0;
      const normalized = [];
      for (const raw of lines) {
        const quantity = num(raw.quantity); const unitCost = num(raw.unit_cost); const lineVat = num(raw.vat_amount ?? 0); const weight = num(raw.weight_grams ?? 0);
        if (!raw.raw_description || quantity === null || quantity <= 0 || unitCost === null || unitCost < 0 || lineVat === null || lineVat < 0 || weight === null || weight < 0) return NextResponse.json({ error: "invalid_purchase_line" }, { status: 400 });
        subtotal += quantity * unitCost; vat += lineVat;
        normalized.push({ product_id: raw.product_id || null, raw_description: String(raw.raw_description).slice(0, 500), sku: raw.sku ? String(raw.sku).slice(0, 80) : null, barcode: raw.barcode ? String(raw.barcode).slice(0, 80) : null, karat: raw.karat ? String(raw.karat).slice(0, 20) : null, country_of_origin: raw.country_of_origin ? String(raw.country_of_origin).slice(0, 80) : null, quantity, weight_grams: weight, unit_cost: unitCost, making_charge: num(raw.making_charge ?? 0) ?? 0, vat_amount: lineVat });
      }
      const { data: purchase, error } = await supabase.from("gmp_purchases").insert({ organization_id: organization.id, branch_id: body.branch_id || null, store_id: storeId, supplier_id: body.supplier_id || null, invoice_no: body.invoice_no ? String(body.invoice_no).slice(0, 80) : null, status: "draft", subtotal, vat_amount: vat, total: subtotal + vat, created_by: user.id }).select("*").single();
      if (error || !purchase) return NextResponse.json({ error: error?.message ?? "purchase_create_failed" }, { status: 400 });
      const { error: lineError } = await supabase.from("gmp_purchase_lines").insert(normalized.map(line => ({ ...line, purchase_id: purchase.id })));
      if (lineError) return NextResponse.json({ error: lineError.message, purchase_id: purchase.id }, { status: 400 });
      return NextResponse.json({ success: true, row: purchase }, { status: 201 });
    }
    return NextResponse.json({ error: "unsupported_operation" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}
