"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MetalSnapshot } from "../../lib/types";
import type { PublicPricePoint } from "../../lib/market-history";
import MoneyDisplay from "../../components/MoneyDisplay";

function money(value: number | null | undefined, currency: string, digits = 3) {
  return <MoneyDisplay value={value} currency={currency} locale="en-US" maximumFractionDigits={digits} />;
}

function MiniChart({ points, currency }: { points: PublicPricePoint[]; currency: string }) {
  const values = points.map((p) => p.value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length < 2) {
    return <div className="terminal-empty-chart">لا توجد بيانات تاريخية كافية حاليًا.</div>;
  }
  const width = 900, height = 260, pad = 22;
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(max - min, Math.abs(max) * 1e-9, 1e-9);
  const d = points.map((point, index) => {
    const value = typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null;
    if (value == null) return null;
    const x = pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return (index ? "L" : "M") + " " + x.toFixed(2) + " " + y.toFixed(2);
  }).filter(Boolean).join(" ");
  return (
    <div className="gold-history">
      <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label="Silver price history">
        <path d={d} className="chart-line" fill="none" />
      </svg>
      <div><span>{money(min, currency)}</span><span>{money(max, currency)}</span></div>
    </div>
  );
}

export default function SilverIntelligence({
  language,
  countryCode,
  countryName,
  currency,
  silver,
  history,
}: {
  language: string;
  countryCode: string;
  countryName: string;
  currency: string;
  silver: MetalSnapshot;
  history: PublicPricePoint[];
}) {
  const rtl = ["ar", "fa", "he", "ur"].includes(language);
  const [threshold, setThreshold] = useState("");
  const [message, setMessage] = useState("");
  const [rules, setRules] = useState<Array<{ id: string; instrument_code: string; rule_type: string; threshold: number | null; active: boolean; cooldown_minutes: number }>>([]);
  const [busy, setBusy] = useState(false);

  async function loadRules() {
    const response = await fetch("/api/alerts/rules", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) setRules(data?.rules ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/alerts/rules", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (response.ok && !cancelled) setRules(data?.rules ?? []);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function createAlert() {
    setMessage("");
    const amount = Number(threshold);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("أدخل قيمة صحيحة للتنبيه.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instrument_code: "XAG" + currency,
          rule_type: "price_above",
          threshold: amount,
          cooldown_minutes: 30,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) setMessage("سجّل الدخول لإنشاء التنبيه.");
      else if (!response.ok) setMessage(data?.error === "active_rule_exists" ? "لديك تنبيه مماثل مفعّل." : "تعذر إنشاء التنبيه.");
      else {
        setMessage("تم إنشاء التنبيه.");
        setThreshold("");
        await loadRules();
      }
    } catch {
      setMessage("تعذر الاتصال بالخادم.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stage1-shell" dir={rtl ? "rtl" : "ltr"} lang={language}>
      <header className="topbar">
        <div className="container nav stage1-nav">
          <Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link>
          <div className="stage1-nav-title"><span className="eyebrow">{language === "ar" ? "ذكاء الفضة المتقدم" : "ADVANCED SILVER INTELLIGENCE"}</span><strong>{countryName} · {currency}</strong></div>
          <div className="nav-actions">
            <Link className="btn btn-ghost" href={"/gold?country=" + countryCode + "&language=" + language}>{language === "ar" ? "ذكاء الذهب" : "Gold Intelligence"}</Link>
            <Link className="btn btn-primary" href="/login">الدخول</Link>
          </div>
        </div>
      </header>

      <main className="container stage1-main">
        <section className="gold-intro">
          <div>
            <div className="eyebrow"><span className="live-dot" />{language === "ar" ? "ذكاء الفضة المتقدم" : "ADVANCED SILVER INTELLIGENCE"}</div>
            <h1>الفضة كنظام بيانات، لا كسعر فقط.</h1>
            <p>الأونصة، الغرام، النقاوة، Spot/Bid/Ask، التاريخ والتنبيهات في مساحة واحدة للمتابعة اليومية.</p>
          </div>
          <div className="gold-live-card">
            <span>999 / {language === "ar" ? "غرام" : "GRAM"}</span>
            <strong>{money(silver.perGram24k, currency)}</strong>
            <em>{silver.status}</em>
            <small>{silver.provider || "مصدر البيانات غير متاح"}</small>
          </div>
        </section>

        <section className="gold-overview">
          <div className="gold-spot">
            <span>{language === "ar" ? "السعر الفوري / الأونصة" : "SPOT / OUNCE"}</span>
            <strong>{money(silver.spot, currency, 2)}</strong>
            <div className="gold-triple">
              <div><span>{language === "ar" ? "شراء" : "BID"}</span><b>{money(silver.bid, currency, 2)}</b></div>
              <div><span>{language === "ar" ? "عرض" : "ASK"}</span><b>{money(silver.ask, currency, 2)}</b></div>
              <div><span>{language === "ar" ? "الوحدة" : "UNIT"}</span><b>{language === "ar" ? "غرام / أونصة" : "GRAM / OUNCE"}</b></div>
            </div>
          </div>
          <div className="gold-purity-card">
            <span className="micro-label">{language === "ar" ? "مصفوفة النقاوة" : "PURITY MATRIX"}</span>
            <div><span>999‰</span><b>{money(silver.purities["999"] ?? silver.perGram24k, currency)}</b></div>
            <div><span>الوحدة</span><b>غرام</b></div>
            <div><span>الأونصة</span><b>{money(silver.spot, currency, 2)}</b></div>
          </div>
        </section>

        <section className="gold-history-card">
          <div className="terminal-card-head">
            <div><span className="micro-label">{language === "ar" ? "سجل السعر" : "PRICE HISTORY"}</span><strong>آخر 24 ساعة مسجلة</strong></div>
            <div className="terminal-source">{history.length} {language === "ar" ? "بيانات مسجلة" : "observations"} · {silver.status}</div>
          </div>
          <MiniChart points={history} currency={currency} />
        </section>

        <section className="terminal-grid-two">
          <section className="terminal-card">
            <div className="terminal-card-head">
              <div><span className="micro-label">{language === "ar" ? "لقطة السوق" : "MARKET SNAPSHOT"}</span><strong>قراءة الفضة</strong></div>
            </div>
            <div className="compare-grid">
              <div><span>24K / GRAM</span><b>{money(silver.perGram24k, currency)}</b></div>
              <div><span>SPOT</span><b>{money(silver.spot, currency, 2)}</b></div>
              <div><span>BID</span><b>{money(silver.bid, currency, 2)}</b></div>
              <div><span>ASK</span><b>{money(silver.ask, currency, 2)}</b></div>
            </div>
            <div className="terminal-footnote">القيم مرجعية حسب المصدر المتاح. لا تُعامل كعرض شراء أو بيع من متجر.</div>
          </section>

          <section className="terminal-card">
            <div className="terminal-card-head">
              <div><span className="micro-label">{language === "ar" ? "التنبيهات" : "ALERTS"}</span><strong>تنبيه سعر الفضة</strong></div>
            </div>
            <div className="alert-form">
              <label>نبّهني عندما يتجاوز XAG هذه القيمة
                <input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder={money(silver.spot, currency, 2)} />
              </label>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createAlert()}>إنشاء التنبيه</button>
              {message && <div className="terminal-footnote" role="status">{message}</div>}
            </div>
            <div className="terminal-footnote">التنبيهات تُسجل للحساب وتستخدم طبقة منع التكرار نفسها.</div>
            <div className="alert-rules-list">
              <div className="micro-label">{language === "ar" ? "التنبيهات النشطة" : "ACTIVE RULES"}</div>
              {rules.filter((rule) => rule.instrument_code === "XAG" + currency).length === 0
                ? <div className="terminal-empty">لا توجد تنبيهات محفوظة للفضة.</div>
                : rules.filter((rule) => rule.instrument_code === "XAG" + currency).map((rule) => (
                  <div className="alert-rule-row" key={rule.id}>
                    <div><strong>{rule.instrument_code}</strong><span>{rule.rule_type} · {rule.threshold ?? "—"} · {language === "ar" ? "مهلة" : "cooldown"} {rule.cooldown_minutes}{language === "ar" ? " د" : "m"}</span></div>
                    <span className="status">{rule.active ? "مفعّل" : "معطّل"}</span>
                  </div>
                ))}
            </div>
          </section>
        </section>

        <div className="terminal-footnote">{language === "ar" ? "طبقة الثقة: لا تتم تسمية البيانات القديمة أو التقديرية كمباشرة، ويظهر المصدر والحالة بجانب بيانات السوق." : "Trust layer: stale or estimated data is not labeled LIVE, and source and status remain visible."}</div>
      </main>
    </div>
  );
}
