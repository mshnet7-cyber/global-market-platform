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

  return (
    <div className="display-preferences" aria-label="Display preferences">
      <div className="font-size-controls" role="group" aria-label="Font size">
        <button type="button" className="preference-icon-button preference-font-button" onClick={() => setFontSize("small")} aria-label="Decrease text size" title="Decrease text size" disabled={fontScale === "small"}>
          <Minus size={15} strokeWidth={2.2} />
        </button>
        <span className="font-size-indicator" aria-hidden="true">A</span>
        <button type="button" className="preference-icon-button preference-font-button" onClick={() => setFontSize("large")} aria-label="Increase text size" title="Increase text size" disabled={fontScale === "large"}>
          <Plus size={15} strokeWidth={2.2} />
        </button>
      </div>
      <button
        type="button"
        className="preference-icon-button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
      <div className="preference-language" role="group" aria-label="Language">
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
