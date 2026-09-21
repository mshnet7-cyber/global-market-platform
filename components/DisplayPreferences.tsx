"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const LANGUAGES = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "de", label: "Deutsch" },
] as const;

type Language = (typeof LANGUAGES)[number]["code"];
type Theme = "dark" | "light";

function getCookie(name: string) {
  const prefix = name + "=";
  const item = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

export default function DisplayPreferences({ language }: { language: Language }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = getCookie("gmp-theme");
    const next: Theme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    setTheme(next);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    document.cookie = "gmp-theme=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax";
    setTheme(next);
  }

  function changeLanguage(next: Language) {
    if (next === language) return;
    document.cookie = "gmp-language=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax";
    const url = new URL(window.location.href);
    url.searchParams.set("language", next);
    window.location.assign(url.toString());
  }

  return (
    <div className="display-preferences" aria-label="Display preferences">
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
