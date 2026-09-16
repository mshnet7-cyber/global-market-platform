# Global Market Platform

Public multilingual platform for gold, silver, currencies, news, shops, advertising, and digital shop displays, with a specialized merchant operating system for gold and jewelry businesses.

## MVP scope

Public visitor experience: gold, silver, permitted currency reference data, news, shop discovery, and advertising. No visitor account is required.

Merchant experience: optional subscriptions for Screen, Business, and Full plans. Merchant modules include sales/POS, purchases, expenses, customers and suppliers, inventory, repairs, person-to-person gold purchases, accounting, tax reporting, AI/OCR, WhatsApp delivery, printing/PDF, branches, permissions, audit trail, and display management according to plan entitlements.

Stocks and generic Markets are intentionally excluded from the MVP because external customer-facing financial-data licensing is not yet approved. The provider layer may support them later without exposing them publicly.

## Pricing baseline

- Screen: 5 OMR/month, 25 OMR/6 months, 50 OMR/year. Additional branch/store discount: 2.5%.
- Business: 25 OMR/month, 125 OMR/6 months, 240 OMR/year. Additional branch/store discount: 5%.
- Full: 46 OMR/month, 247 OMR/6 months, 450 OMR/year. Additional branch/store discount: 8%.
- Additional display: 4 OMR/month, 21 OMR/6 months, 44 OMR/year.

## Architecture

Next.js + TypeScript, Supabase/PostgreSQL, Vercel, centralized market-data engine, multi-tenant merchant data model, secure display pairing, country-aware compliance configuration, human-reviewed AI extraction, and channel-based delivery (WhatsApp/PDF/print).
