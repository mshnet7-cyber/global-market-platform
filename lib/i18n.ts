const dictionaries: Record<string, Record<string, string>> = {
  ar: {
    gold: "الذهب", silver: "الفضة", markets: "الأسواق", stocks: "الأسهم", news: "الأخبار", currencies: "العملات", demo: "معاينة شاشة الأسعار", login: "تسجيل الدخول", signup: "إنشاء الحساب", country: "الدولة", language: "اللغة", apply: "تطبيق", createDisplay: "أنشئ شاشة", goldView: "شاهد الذهب", displayDemo: "جرّب شاشة المحل",
    referenceOnly: "السعر المرجعي فقط — ليس سعر شراء/بيع من متجر.", unavailable: "البيانات غير متاحة حاليًا", noNews: "لا يوجد مصدر أخبار خارجي مفعّل حاليًا.",
    referenceFooter: "معلومات مرجعية فقط. ليست وساطة أو استشارة استثمارية.", spot: "فوري", bid: "شراء مرجعي", ask: "بيع مرجعي", gram: "غرام", change: "التغير", close: "الإغلاق", percent: "النسبة", marketDataNote: "بيانات الأسواق المعروضة هي بيانات سوق مرجعية متأخرة/نهاية اليوم وفق ترخيص المصدر.",
    statusLive: "مباشر", statusDelayed: "متأخر", statusStale: "قديم", statusUnavailable: "غير متاح", globalReference: "منصة الأسواق العالمية",
    heroTitle: "الذهب والفضة والأسواق والأخبار، في منصة واحدة.", heroDescription: "بيانات مرجعية مجانية للزوار، مع أدوات تشغيل متكاملة لأصحاب المحلات.",
  },
  en: {
    gold: "Gold", silver: "Silver", markets: "Markets", stocks: "Stocks", news: "News", currencies: "Currencies", demo: "Display Preview", login: "Login", signup: "Create account", country: "Country", language: "Language", apply: "Apply", createDisplay: "Create Display",
    goldView: "View gold", displayDemo: "Try the shop display", referenceOnly: "Reference price only — not a shop buy/sell price.", unavailable: "Data is currently unavailable", noNews: "No external news source is enabled.",
    referenceFooter: "Reference information only. Not brokerage or investment advice.", spot: "Spot", bid: "Bid", ask: "Ask", gram: "gram", change: "Change", close: "Close", percent: "%", marketDataNote: "Displayed market data is delayed/end-of-day reference data subject to the source license.", statusLive: "LIVE", statusDelayed: "DELAYED", statusStale: "STALE", statusUnavailable: "UNAVAILABLE",
    globalReference: "GLOBAL MARKET PLATFORM", heroTitle: "Gold, silver, markets and news in one platform.", heroDescription: "Free public reference data for visitors, with integrated operating tools for shop owners.",
  },
  tr: {
    gold: "Altın", silver: "Gümüş", markets: "Piyasalar", stocks: "Hisseler", news: "Haberler", currencies: "Para Birimleri", demo: "Ekran Önizleme", login: "Giriş", signup: "Hesap oluştur", country: "Ülke", language: "Dil", apply: "Uygula", createDisplay: "Ekran Oluştur",
    goldView: "Altını görüntüle", displayDemo: "Mağaza ekranını dene", referenceOnly: "Yalnızca referans fiyatı — mağaza alış/satış fiyatı değildir.", unavailable: "Veri şu anda kullanılamıyor", noNews: "Harici haber kaynağı etkin değil.",
    referenceFooter: "Yalnızca referans bilgileri. Aracılık veya yatırım tavsiyesi değildir.", spot: "Spot", bid: "Alış", ask: "Satış", gram: "gram", change: "Değişim", close: "Kapanış", percent: "%", marketDataNote: "Gösterilen piyasa verileri, sağlayıcı lisansına tabi gecikmeli/gün sonu referans verileridir.", statusLive: "CANLI", statusDelayed: "GECİKMELİ", statusStale: "ESKİ", statusUnavailable: "KULLANILAMIYOR",
    globalReference: "GLOBAL MARKET PLATFORM", heroTitle: "Altın, gümüş, piyasalar ve haberler tek platformda.", heroDescription: "Ziyaretçiler için ücretsiz referans verileri ve mağaza sahipleri için entegre işletme araçları.",
  },
  de: {
    gold: "Gold", silver: "Silber", markets: "Märkte", stocks: "Aktien", news: "Nachrichten", currencies: "Währungen", demo: "Display-Vorschau", login: "Anmelden", signup: "Konto erstellen", country: "Land", language: "Sprache", apply: "Anwenden", createDisplay: "Display erstellen",
    goldView: "Gold ansehen", displayDemo: "Ladenanzeige testen", referenceOnly: "Nur Referenzpreis — kein An-/Verkaufspreis eines Händlers.", unavailable: "Daten derzeit nicht verfügbar", noNews: "Keine externe Nachrichtenquelle aktiviert.",
    referenceFooter: "Nur Referenzinformationen. Keine Anlageberatung oder Vermittlung.", spot: "Spot", bid: "Geldkurs", ask: "Briefkurs", gram: "Gramm", change: "Änderung", close: "Schlusskurs", percent: "%", marketDataNote: "Angezeigte Marktdaten sind verzögerte/Tagesenddaten nach Lizenz des Datenanbieters.", statusLive: "LIVE", statusDelayed: "VERZÖGERT", statusStale: "VERALTET", statusUnavailable: "NICHT VERFÜGBAR",
    globalReference: "GLOBAL MARKET PLATFORM", heroTitle: "Gold, Silber, Märkte und Nachrichten auf einer Plattform.", heroDescription: "Kostenlose Referenzdaten für Besucher und integrierte Betriebswerkzeuge für Händler.",
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
