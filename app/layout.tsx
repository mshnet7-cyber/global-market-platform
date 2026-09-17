import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./premium.css";
import "./ux-overrides.css";

export const metadata: Metadata = {
  title: "Global Market Platform | Global market prices",
  description: "Global market information for gold, silver, currencies, markets, stocks and news, with professional merchant display tools.",
  keywords: ["gold prices", "silver prices", "global markets", "currencies", "merchant display", "Global Market"],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
