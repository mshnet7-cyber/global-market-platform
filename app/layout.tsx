import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Market Platform",
  description: "Gold, silver, markets, stocks and trusted financial news.",
  robots: { index: true, follow: true },
};

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur"]);

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headerStore = await headers();
  const rawLanguage = headerStore.get("x-gmp-language")?.toLowerCase() ?? "ar";
  const language = /^[a-z]{2,3}$/.test(rawLanguage) ? rawLanguage : "ar";
  const dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";

  return (
    <html lang={language} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
