import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Market Platform",
  description: "Gold, silver, markets, stocks and trusted financial news.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
