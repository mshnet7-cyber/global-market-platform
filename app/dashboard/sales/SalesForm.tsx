"use client";

import { useMemo, useState } from "react";

export default function SalesForm({ stores, products }: {
  stores: Array<{ id: string; name: string; branch_id: string | null; currency: string }>;
  products: Array<{ id: string; name: string; sku: string | null; barcode: string | null; karat: string | null; weight_grams: number | null; price: number; making_charge: number; current_quantity: number; current_weight_grams: number; }>;
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState(String(products[0]?.price ?? 0));
  const [weight, setWeight] = useState(String(products[0]?.weight_grams ?? 0));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const selected = useMemo(() => products.find(p => p.id === productId) ?? null, [products, productId]);

  function selectProduct(id: string) {
    setProductId(id);
    const p = products.find(x => x.id === id);
    if (p) {
      setUnitPrice(String(p.price));
      setWeight(String(p.weight_grams ?? 0));
    }
  }

  async function submit() {
    setBusy(true); setResult("");
    try {
      const res = await fetch("/api/merchant/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          payment_method: paymentMethod,
          lines: [{ product_id: productId, quantity: Number(quantity), weight_grams: Number(weight), unit_price: Number(unitPrice), making_charge: Number(selected?.making_charge ?? 0), discount_amount: 0, vat_amount: 0 }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذر إتمام البيع");
      setResult(`تم إصدار الفاتورة رقم ${data.invoice_no} بإجمالي ${data.total}.`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  }

  if (!stores.length) return <div className="notice">لا يوجد متجر متاح لهذا الحساب.</div>;
  if (!products.length) return <div className="notice">لا توجد أصناف نشطة. أضف صنفًا إلى المخزون أولًا.</div>;

  return <section className="card" style={{marginTop:24}}>
    <div className="grid two-col">
      <label className="label">المحل<select className="select" value={storeId} onChange={e => setStoreId(e.target.value)}>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="label">طريقة الدفع<select className="select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="cash">نقدي</option><option value="bank">تحويل/بنك</option><option value="card">بطاقة</option><option value="wallet">محفظة</option><option value="other">أخرى</option></select></label>
      <label className="label">الصنف<select className="select" value={productId} onChange={e => selectProduct(e.target.value)}>{products.map(p => <option key={p.id} value={p.id}>{p.name}{p.karat ? ` · ${p.karat}` : ""}{p.barcode ? ` · ${p.barcode}` : ""}</option>)}</select></label>
      <label className="label">الكمية<input className="select" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      <label className="label">الوزن (غرام)<input className="select" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} /></label>
      <label className="label">سعر الوحدة<input className="select" inputMode="decimal" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} /></label>
    </div>
    <div className="notice" style={{marginTop:16}}>المخزون المتاح: {selected?.current_quantity ?? 0} وحدة · {selected?.current_weight_grams ?? 0} غ</div>
    <div className="actions" style={{marginTop:16}}><button className="btn primary" onClick={submit} disabled={busy}>{busy ? "جارٍ الترحيل…" : "اعتماد البيع"}</button>{result && <span className="notice">{result}</span>}</div>
  </section>;
}
