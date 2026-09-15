const dictionaries: Record<string, Record<string, string>> = {
  ar: {
    gold: "الذهب", silver: "الفضة", markets: "الأسواق", stocks: "الأسهم", news: "الأخبار",
    demo: "معاينة شاشة الأسعار", login: "تسجيل الدخول", signup: "إنشاء الحساب",
    country: "الدولة", language: "اللغة", apply: "تطبيق", createDisplay: "أنشئ شاشة",
    goldView: "شاهد الذهب", displayDemo: "جرّب شاشة المحل", referenceOnly: "السعر المرجعي فقط — ليس سعر شراء/بيع من متجر.",
    unavailable: "البيانات غير متاحة حاليًا", noMarkets: "لا يوجد مصدر أسواق مسموح مفعّل حاليًا.",
    noStocks: "لا يوجد مصدر أسهم تجاري مسموح للعرض الخارجي حاليًا.", noNews: "لا يوجد مصدر أخبار خارجي مفعّل حاليًا.",
    referenceFooter: "معلومات مرجعية فقط. ليست وساطة أو استشارة استثمارية.",
    spot: "فوري", bid: "شراء مرجعي", ask: "بيع مرجعي", gram: "غرام",
    statusLive: "مباشر", statusDelayed: "متأخر", statusStale: "قديم", statusUnavailable: "غير متاح",
    globalReference: "مرجع الأسواق العالمية", heroTitle: "أسعار وأسواق العالم، في منصة واحدة.",
    heroDescription: "ذهب وفضة وأسواق وأسهم وأخبار مالية، مع دولة ولغة وعملة قابلة للتغيير بشكل مستقل.",
    marketsKicker: "الأسواق", stocksKicker: "الأسهم الأكثر متابعة",
  },
  en: {
    gold: "Gold", silver: "Silver", markets: "Markets", stocks: "Stocks", news: "News",
    demo: "Display Preview", login: "Login", signup: "Create account",
    country: "Country", language: "Language", apply: "Apply", createDisplay: "Create Display",
    goldView: "View gold", displayDemo: "Try the shop display", referenceOnly: "Reference price only — not a shop buy/sell price.",
    unavailable: "Data is currently unavailable", noMarkets: "No permitted live market source is enabled.",
    noStocks: "No externally permitted commercial stock source is enabled.", noNews: "No external news source is enabled.",
    referenceFooter: "Reference information only. Not brokerage or investment advice.",
    spot: "Spot", bid: "Bid", ask: "Ask", gram: "gram",
    statusLive: "LIVE", statusDelayed: "DELAYED", statusStale: "STALE", statusUnavailable: "UNAVAILABLE",
    globalReference: "GLOBAL MARKET REFERENCE", heroTitle: "World prices and markets in one platform.",
    heroDescription: "Gold, silver, markets, stocks and financial news, with country, language and currency chosen independently.",
    marketsKicker: "MARKETS", stocksKicker: "POPULAR STOCKS",
  },
  tr: {
    gold: "Altın", silver: "Gümüş", markets: "Piyasalar", stocks: "Hisseler", news: "Haberler",
    demo: "Ekran Önizleme", login: "Giriş", signup: "Hesap oluştur",
    country: "Ülke", language: "Dil", apply: "Uygula", createDisplay: "Ekran Oluştur",
    goldView: "Altını görüntüle", displayDemo: "Mağaza ekranını dene", referenceOnly: "Yalnızca referans fiyatı — mağaza alış/satış fiyatı değildir.",
    unavailable: "Veri şu anda kullanılamıyor", noMarkets: "İzin verilen canlı piyasa kaynağı etkin değil.",
    noStocks: "Harici gösterime izin verilen ticari hisse kaynağı etkin değil.", noNews: "Harici haber kaynağı etkin değil.",
    referenceFooter: "Yalnızca referans bilgileri. Aracılık veya yatırım tavsiyesi değildir.",
    spot: "Spot", bid: "Alış", ask: "Satış", gram: "gram",
    statusLive: "CANLI", statusDelayed: "GECİKMELİ", statusStale: "ESKİ", statusUnavailable: "KULLANILAMIYOR",
    globalReference: "KÜRESEL PİYASA REFERANSI", heroTitle: "Dünya fiyatları ve piyasaları tek platformda.",
    heroDescription: "Altın, gümüş, piyasalar, hisseler ve finans haberleri; ülke, dil ve para birimi bağımsız seçilebilir.",
    marketsKicker: "PİYASALAR", stocksKicker: "POPÜLER HİSSELER",
  },
  de: {
    gold: "Gold", silver: "Silber", markets: "Märkte", stocks: "Aktien", news: "Nachrichten",
    demo: "Display-Vorschau", login: "Anmelden", signup: "Konto erstellen",
    country: "Land", language: "Sprache", apply: "Anwenden", createDisplay: "Display erstellen",
    goldView: "Gold ansehen", displayDemo: "Ladenanzeige testen", referenceOnly: "Nur Referenzpreis — kein An-/Verkaufspreis eines Händlers.",
    unavailable: "Daten derzeit nicht verfügbar", noMarkets: "Keine zulässige Live-Marktquelle aktiviert.",
    noStocks: "Keine zulässige kommerzielle Aktienquelle für externe Anzeige aktiviert.", noNews: "Keine externe Nachrichtenquelle aktiviert.",
    referenceFooter: "Nur Referenzinformationen. Keine Anlageberatung oder Vermittlung.",
    spot: "Spot", bid: "Geldkurs", ask: "Briefkurs", gram: "Gramm",
    statusLive: "LIVE", statusDelayed: "VERZÖGERT", statusStale: "VERALTET", statusUnavailable: "NICHT VERFÜGBAR",
    globalReference: "GLOBALE MARKTREFERENZ", heroTitle: "Weltweite Preise und Märkte auf einer Plattform.",
    heroDescription: "Gold, Silber, Märkte, Aktien und Finanznachrichten; Land, Sprache und Währung unabhängig wählbar.",
    marketsKicker: "MÄRKTE", stocksKicker: "BELIEBTE AKTIEN",
  },
};

export function getMessages(language: string) {
  return dictionaries[language] ?? dictionaries.en;
}

export function getDisplayName(type: "region" | "language", value: string, language: string, fallback: string = value) {
  try {
    return new Intl.DisplayNames([language], { type }).of(value) ?? fallback;
  } catch {
    return fallback;
  }
}

export function isRtlLanguage(language: string) {
  return ["ar", "fa", "he", "ur"].includes(language);
}

export function formatStatus(status: string, messages: Record<string, string>) {
  switch (status.toUpperCase()) {
    case "LIVE": return messages.statusLive;
    case "DELAYED": return messages.statusDelayed;
    case "STALE": return messages.statusStale;
    default: return messages.statusUnavailable;
  }
}
