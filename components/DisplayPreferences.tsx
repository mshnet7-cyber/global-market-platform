"use client";

import { Languages, Minus, Moon, Plus, Sun } from "lucide-react";
import { useState } from "react";

const LANGUAGES = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "de", label: "Deutsch" },
] as const;

type Language = (typeof LANGUAGES)[number]["code"];
type Theme = "dark" | "light";
type FontScale = "small" | "normal" | "large";

export default function DisplayPreferences({ language, initialTheme, initialFontScale }: { language: Language; initialTheme: Theme; initialFontScale: FontScale }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [fontScale, setFontScale] = useState<FontScale>(initialFontScale);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    document.cookie = "gmp-theme=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax";
    setTheme(next);
  }

  function setFontSize(next: FontScale) {
    document.documentElement.dataset.fontScale = next;
    document.cookie = "gmp-font-scale=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax";
    setFontScale(next);
  }

  function changeLanguage(next: Language) {
    if (next === language) return;
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = "gmp-language=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax";
    const url = new URL(window.location.href);
    url.searchParams.set("language", next);
    window.location.assign(url.toString());
  }

  const labels = {
    ar: { prefs: "إعدادات العرض", font: "حجم الخط", decrease: "تصغير الخط", reset: "الحجم الافتراضي", increase: "تكبير الخط", light: "الوضع النهاري", dark: "الوضع الليلي" },
    en: { prefs: "Display settings", font: "Font size", decrease: "Decrease text size", reset: "Reset text size", increase: "Increase text size", light: "Light mode", dark: "Dark mode" },
    tr: { prefs: "Görüntü ayarları", font: "Yazı boyutu", decrease: "Yazıyı küçült", reset: "Varsayılan boyut", increase: "Yazıyı büyüt", light: "Açık tema", dark: "Koyu tema" },
    de: { prefs: "Anzeigeeinstellungen", font: "Schriftgröße", decrease: "Text verkleinern", reset: "Standardgröße", increase: "Text vergrößern", light: "Helles Design", dark: "Dunkles Design" },
  }[language];

  return (
    <div className="display-preferences" aria-label={labels.prefs}>
      <div className="font-size-controls" role="group" aria-label={labels.font}>
        <button type="button" className="preference-icon-button preference-font-button" onClick={() => setFontSize("small")} aria-label={labels.decrease} title={labels.decrease} disabled={fontScale === "small"}>
          <Minus size={15} strokeWidth={2.2} />
        </button>
        <button type="button" className="preference-font-reset" onClick={() => setFontSize("normal")} aria-label={labels.reset} title={labels.reset} disabled={fontScale === "normal"}>A</button>
        <button type="button" className="preference-icon-button preference-font-button" onClick={() => setFontSize("large")} aria-label={labels.increase} title={labels.increase} disabled={fontScale === "large"}>
          <Plus size={15} strokeWidth={2.2} />
        </button>
      </div>
      <button
        type="button"
        className="preference-icon-button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? labels.light : labels.dark}
        title={theme === "dark" ? labels.light : labels.dark}
      >
        {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
      <div className="preference-language" role="group" aria-label={language === "ar" ? "اللغة" : language === "tr" ? "Dil" : language === "de" ? "Sprache" : "Language"}>
        <Languages size={15} strokeWidth={2} aria-hidden="true" />
        {LANGUAGES.map((item) => (
          <button
            type="button"
            key={item.code}
            className="preference-language-button"
            aria-current={language === item.code ? "true" : undefined}
            aria-label={item.label}
            title={item.label}
            onClick={() => changeLanguage(item.code)}
          >
            {item.code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
