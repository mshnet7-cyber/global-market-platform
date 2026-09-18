"use client";

import { useEffect, useMemo, useState } from "react";
import type { MetalSnapshot, Quote } from "../../lib/types";
import type { PublicPricePoint } from "../../lib/market-history";
import Link from "next/link";
import { formatMoneyDisplay } from "../../lib/currency-display";

type TerminalData = {
  gold: MetalSnapshot;
  silver: MetalSnapshot;
  markets: Quote[];
  stocks: Quote[];
  providers: Record<string, readonly string[]>;
  generatedAt: string;
  history: PublicPricePoint[];
  selectedInstrument: string;
};

function fmt(value: number | null | undefined, currency: string, digits = 2) { return formatMoneyDisplay(value, currency, "en-US", digits); }
function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

function Chart({ points, currency }: { points: PublicPricePoint[]; currency: string }) {
  const values = points.map((p) => p.value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length < 2) return <div className="terminal-empty-chart">لا توجد نقاط تاريخية كافية للمخطط.</div>;
  const width = 760, height = 240, pad = 22;
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, Math.abs(max) * 0.000001, 1e-9);
  const path = points.map((p, i) => {
    const v = typeof p.value === "number" && Number.isFinite(p.value) ? p.value : null;
    if (v == null) return null;
    const usable = Math.max(1, points.length - 1);
    const x = pad + (i / usable) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return (i ? "L" : "M") + " " + x.toFixed(2) + " " + y.toFixed(2);
  }).filter(Boolean).join(" ");
  return <div className="terminal-chart-wrap">
    <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label="Price history chart">
      <path d={"M " + pad + " " + (height-pad) + " L " + (width-pad) + " " + (height-pad)} className="chart-axis" />
      <path d={path} className="chart-line" fill="none" />
    </svg>
    <div className="terminal-chart-ends"><span>{fmt(min, currency)}</span><span>{fmt(max, currency)}</span></div>
  </div>;
}

export default function MarketTerminal({ language, countryCode, countryName, currency, initial }: {
  language: string;
  countryCode: string;
  countryName: string;
  currency: string;
  initial: TerminalData;
}) {
  const rtl = ["ar", "fa", "he", "ur"].includes(language);
  const [data, setData] = useState(initial);
  const [range, setRange] = useState<"1D"|"1W"|"1M"|"1Y">("1D");
  const [selected, setSelected] = useState(initial.selectedInstrument);
  const [filter, setFilter] = useState<"all"|"watchlist">("all");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [now, setNow] = useState<string>(initial.generatedAt);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("gmp_market_watchlist") || "[]");
        if (Array.isArray(stored)) setWatchlist(stored.map(String).slice(0, 100));
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const refresh = async () => {
      try {
        const url = "/api/market/terminal?country=" + countryCode + "&language=" + language + "&instrument=" + encodeURIComponent(selected) + "&range=" + range;
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json();
        setData(next);
        setNow(String(next.generatedAt ?? new Date().toISOString()));
      } catch {}
    };
    void refresh();
    const id = window.setInterval(refresh, 30000);
    return () => window.clearInterval(id);
  }, [countryCode, language, selected, range]);

  const allQuotes = useMemo(() => [...data.markets, ...data.stocks], [data.markets, data.stocks]);
  const selectedQuote = allQuotes.find((q) => q.symbol === selected || q.instrument === selected) ?? null;
  const selectedIsGold = selected === ("XAU" + currency) || selected === "XAUOMR" || selected === "XAUUSD";
  const selectedIsSilver = selected === ("XAG" + currency) || selected === "XAGOMR" || selected === "XAGUSD";
  const selectedCurrency = selectedIsGold || selectedIsSilver ? currency : selectedQuote?.currency ?? "USD";
  const currentValue = selectedIsGold ? data.gold.spot : selectedIsSilver ? data.silver.spot : selectedQuote?.spot ?? null;
  const historyValues = data.history.map((p) => p.value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const high = historyValues.length ? Math.max(...historyValues) : null;
  const low = historyValues.length ? Math.min(...historyValues) : null;
  const derivedChange = historyValues.length >= 2 ? historyValues[historyValues.length - 1] - historyValues[0] : selectedQuote?.change ?? null;
  const derivedPercent = historyValues.length >= 2 && historyValues[0] ? (derivedChange! / historyValues[0]) * 100 : selectedQuote?.changePercent ?? null;
  const rows = allQuotes.filter((q) => filter === "all" || watchlist.includes(q.symbol ?? q.instrument));

  function toggleWatch(code: string) {
    setWatchlist((current) => {
      const next = current.includes(code) ? current.filter((x) => x !== code) : [...current, code];
      try { localStorage.setItem("gmp_market_watchlist", JSON.stringify(next.slice(0, 100))); } catch {}
      return next;
    });
  }

  return <div className="stage1-shell" dir={rtl ? "rtl" : "ltr"} lang={language}>
    <header className="topbar"><div className="container nav stage1-nav">
      <Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link>
      <div className="stage1-nav-title"><span className="eyebrow">MARKET INTELLIGENCE</span><strong>{countryName} · {currency}</strong></div>
      <div className="nav-actions"><Link className="btn btn-ghost" href={"/gold?country=" + countryCode + "&language=" + language}>الذهب المتقدم</Link><Link className="btn btn-primary" href="/login">الدخول</Link></div>
    </div></header>
    <main className="container stage1-main">
      <section className="terminal-hero">
        <div><div className="eyebrow"><span className="live-dot" />GLOBAL MARKET TERMINAL</div><h1>{language === "ar" ? "مركز ذكاء السوق." : "Market intelligence terminal."}</h1><p>{language === "ar" ? "الأسعار، التغير، التاريخ، المقارنة وحالة المصدر في مساحة واحدة." : "Prices, change, history, comparison and source trust in one focused workspace."}</p></div>
        <div className="terminal-hero-gold"><span>24K / GRAM</span><strong>{fmt(data.gold.perGram24k, currency, 3)}</strong><em>{data.gold.status}</em></div>
      </section>
      <section className="terminal-layout">
        <aside className="terminal-sidebar">
          <div className="terminal-sidebar-head"><strong>WATCHLIST</strong><button type="button" className="terminal-filter" onClick={() => setFilter(filter === "all" ? "watchlist" : "all")}>{filter === "all" ? "ALL" : "WATCHLIST"}</button></div>
          <button type="button" className={"terminal-instrument " + (selectedIsGold ? "active" : "")} onClick={() => setSelected("XAU" + currency)}><span>Au</span><div><strong>Gold 24K</strong><small>{fmt(data.gold.perGram24k, currency, 3)} / g</small></div></button>
          <button type="button" className={"terminal-instrument " + (selectedIsSilver ? "active" : "")} onClick={() => setSelected("XAG" + currency)}><span>Ag</span><div><strong>Silver 999</strong><small>{fmt(data.silver.perGram24k, currency, 3)} / g</small></div></button>
          {rows.map((q) => {
            const code = q.symbol ?? q.instrument;
            const active = selected === code;
            return <div className="terminal-instrument-row" key={code}><button type="button" className={"terminal-instrument " + (active ? "active" : "")} onClick={() => setSelected(code)}><span>{(q.symbol ?? "MK").slice(0,3)}</span><div><strong>{q.symbol ?? q.instrument}</strong><small>{fmt(q.spot, q.currency)} · {pct(q.changePercent)}</small></div></button><button type="button" className="terminal-watch-toggle" aria-label={(watchlist.includes(code) ? "إزالة " : "إضافة ") + "من قائمة المتابعة " + code} onClick={() => toggleWatch(code)}>{watchlist.includes(code) ? "★" : "☆"}</button></div>;
          })}
          {filter === "watchlist" && rows.length === 0 ? <div className="terminal-empty">لا توجد رموز في القائمة.</div> : null}
        </aside>
        <section className="terminal-content">
          <div className="terminal-toolbar"><div><span className="micro-label">{selectedIsGold ? "XAU" : selectedIsSilver ? "XAG" : selectedQuote?.exchange ?? "GLOBAL"}</span><h2>{selectedIsGold ? "Gold Spot" : selectedIsSilver ? "Silver Spot" : selectedQuote?.instrument ?? selected}</h2></div><div className="range-tabs">{(["1D","1W","1M","1Y"] as const).map((r) => <button type="button" className={range === r ? "active" : ""} onClick={() => setRange(r)} key={r}>{r}</button>)}</div></div>
          <div className="terminal-primary-metrics"><div><span>PRICE</span><strong>{fmt(currentValue, selectedCurrency)}</strong></div><div><span>CHANGE</span><b className={Number(derivedPercent) > 0 ? "up" : Number(derivedPercent) < 0 ? "down" : ""}>{fmt(derivedChange, selectedCurrency)} · {pct(derivedPercent)}</b></div><div><span>HIGH</span><strong>{fmt(high, selectedCurrency)}</strong></div><div><span>LOW</span><strong>{fmt(low, selectedCurrency)}</strong></div></div>
          <div className="terminal-chart-card"><div className="terminal-card-head"><div><span className="micro-label">HISTORY</span><strong>{data.history.length ? (data.history.length + " observations") : "No history"}</strong></div><div className="terminal-source">{selectedIsGold ? data.gold.provider : selectedIsSilver ? data.silver.provider : selectedQuote?.provider ?? "UNAVAILABLE"} · {selectedIsGold ? data.gold.status : selectedIsSilver ? data.silver.status : selectedQuote?.status ?? "UNAVAILABLE"}</div></div><Chart points={data.history} currency={selectedIsGold ? currency : selectedQuote?.currency ?? "USD"} /></div>
          <div className="terminal-grid-two">
            <section className="terminal-card"><div className="terminal-card-head"><div><span className="micro-label">SOURCE TRUST</span><strong>سجل المصدر والحالة</strong></div></div><div className="trust-list"><div><span>المصدر</span><b>{selectedIsGold ? data.gold.provider : selectedIsSilver ? data.silver.provider : selectedQuote?.provider ?? "—"}</b></div><div><span>الحالة</span><b>{selectedIsGold ? data.gold.status : selectedIsSilver ? data.silver.status : selectedQuote?.status ?? "—"}</b></div><div><span>آخر تحديث</span><b>{selectedIsGold ? (data.gold.timestamp ? new Date(data.gold.timestamp).toLocaleString() : "—") : selectedIsSilver ? (data.silver.timestamp ? new Date(data.silver.timestamp).toLocaleString() : "—") : (selectedQuote?.timestamp ? new Date(selectedQuote.timestamp).toLocaleString() : "—")}</b></div><div><span>آخر فحص</span><b>{now ? new Date(now).toLocaleString() : "—"}</b></div></div></section>
            <section className="terminal-card"><div className="terminal-card-head"><div><span className="micro-label">COMPARISON</span><strong>مقارنة سريعة</strong></div></div><div className="compare-grid"><div><span>Spot</span><b>{fmt(currentValue, selectedCurrency)}</b></div><div><span>High</span><b>{fmt(high, selectedIsGold ? currency : selectedQuote?.currency ?? "USD")}</b></div><div><span>Low</span><b>{fmt(low, selectedIsGold ? currency : selectedQuote?.currency ?? "USD")}</b></div><div><span>Change</span><b>{pct(derivedPercent)}</b></div></div></section>
          </div>
          <div className="terminal-footnote">Fail-closed: البيانات غير الموثوقة أو القديمة لا تُعرض كـLIVE.</div>
        </section>
      </section>
    </main>
  </div>;
}
