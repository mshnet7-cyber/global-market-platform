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

const CSS_PAINT_GATE = `html[data-css-paint-gate="true"] body{visibility:hidden}html[data-css-paint-gate="true"] body:before{content:"";position:fixed;inset:0;background:#061017;z-index:2147483647;pointer-events:none}html[data-css-paint-gate="true"] body:after{content:"";position:fixed;inset:0;background:#061017;z-index:2147483646;pointer-events:none}`;

const CSS_PAINT_SCRIPT = `(()=>{const ready=()=>document.documentElement.removeAttribute("data-css-paint-gate");if(document.readyState==="loading")window.addEventListener("load",ready,{once:true});else ready();})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headerStore = await headers();
  const rawLanguage = headerStore.get("x-gmp-language")?.toLowerCase() ?? "ar";
  const language = /^[a-z]{2,3}$/.test(rawLanguage) ? rawLanguage : "ar";
  const dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";

  return (
    <html lang={language} dir={dir} data-css-paint-gate="true">
      <head>
        <style dangerouslySetInnerHTML={{ __html: CSS_PAINT_GATE }} />
        <script dangerouslySetInnerHTML={{ __html: CSS_PAINT_SCRIPT }} />
        <noscript>
          <style>{`html[data-css-paint-gate="true"] body{visibility:visible}html[data-css-paint-gate="true"] body:before,html[data-css-paint-gate="true"] body:after{display:none}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
