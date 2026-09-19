# Global Market Platform

Public multilingual platform for gold, silver, currencies, markets, stocks, news, shops, advertising, and digital shop displays, with a specialized merchant operating system for gold and jewelry businesses.

## Current scope

Public visitor experience: gold, silver, permitted currency reference data, markets, stocks, news, shop discovery, advertising, and digital-display preview. Visitor accounts are not required for public content.

Market and stock pages are provider-gated. They only publish customer-facing quotes when a configured data provider has the required commercial display/republication rights. Without that approval, the pages fail closed instead of presenting unlicensed data as commercial content.

Merchant experience: optional subscriptions for Screen, Business, and Full plans. Merchant modules include sales/POS, purchases, expenses, customers and suppliers, inventory, repairs, person-to-person gold purchases, accounting, tax reporting, AI/OCR, WhatsApp delivery, printing/PDF, branches, permissions, audit trail, and display management according to plan entitlements.

## Pricing baseline

- Screen: 5 OMR/month, 25 OMR/6 months, 50 OMR/year. Additional branch/store discount: 2.5%.
- Business: 25 OMR/month, 125 OMR/6 months, 240 OMR/year. Additional branch/store discount: 5%.
- Full: 46 OMR/month, 247 OMR/6 months, 450 OMR/year. Additional branch/store discount: 8%.
- Additional display: 4 OMR/month, 21 OMR/6 months, 44 OMR/year.

## Architecture

Next.js + TypeScript, Supabase/PostgreSQL, Vercel-compatible build, and Cloudflare Workers/vinext deployment path, with a centralized market-data engine, multi-tenant merchant data model, secure display pairing, country-aware compliance configuration, human-reviewed AI extraction, and channel-based delivery (WhatsApp/PDF/print).

## Production readiness

The application keeps Vercel compatibility while providing a Cloudflare Workers deployment path through vinext. Supabase remains the primary data/authentication layer. CI builds the application on every push and pull request. Production market data remains fail-closed until commercial provider rights are configured.

Current hardening status: legacy Sukna SECURITY DEFINER RPC execution is locked to trusted server-side roles; merchant compliance and e-invoicing status transitions are enforced at the database boundary and checked again at the API boundary; camera endpoints reject credential-bearing URLs; and project structural/contract tests, lint, and production build all pass in CI.

Known external launch dependencies are kept explicit rather than simulated: commercial market-data licensing, payment checkout/webhooks, official e-invoicing integrations, WhatsApp credentials, AI/OCR provider credentials, and Supabase Auth leaked-password protection.

## Cloudflare Workers deployment

The repository contains a parallel Cloudflare Workers path for the Next.js 16 App Router. It uses vinext, the Cloudflare Vite plugin, a Worker entrypoint for the existing scheduled jobs, and Wrangler configuration. The existing Next.js/Vercel commands remain intact.

Run `npm run check:vinext` before adoption, `npm run build:vinext` to build the Workers target, and `npm run deploy:cloudflare:dry-run` to validate the deployment configuration without deploying. After Cloudflare authentication, use `npm run deploy:cloudflare` for the real deployment. The Worker can use a `workers.dev` hostname or a custom domain.

Cloudflare Workers Free is a continuous serverless runtime rather than an unlimited plan: current documented limits include 100,000 requests/day and 3,000 Workers Build minutes/month. The two application cron schedules are within the documented five-cron Free-account allowance. Vinext is currently beta, so the Cloudflare path is maintained separately until runtime compatibility is verified in the deployed environment.
