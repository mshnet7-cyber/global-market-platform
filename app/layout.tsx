import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import PwaRegister from "./PwaRegister";
import "./globals.css";
import "./premium.css";
import "./ux-overrides.css";
import "./launch-refinement.css";
import "./stage1-core.css";
import "./stage2.css";
import "./stage3.css";
import "./visual-polish.css";

export const metadata: Metadata = {
  title: "Global Market Platform | Global market prices",
  description: "Global market information for gold, silver, currencies, markets, stocks and news, with professional merchant display tools.",
  keywords: ["gold prices", "silver prices", "global markets", "currencies", "merchant display", "Global Market"],
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061017",
};

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur"]);

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const rawLanguage = headerStore.get("x-gmp-language")?.toLowerCase() ?? cookieStore.get("gmp-language")?.value?.toLowerCase() ?? "ar";
  const language = /^(ar|en|tr|de)$/.test(rawLanguage) ? rawLanguage : "ar";
  const theme = cookieStore.get("gmp-theme")?.value === "light" ? "light" : "dark";
  const dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
  return (
    <html lang={language} dir={dir} data-theme={theme} suppressHydrationWarning>
      <head>
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
