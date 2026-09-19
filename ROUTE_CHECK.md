# Route Check

This document tracks the current App Router surface and is kept aligned with the repository rather than older staging assumptions.

## Public visitor routes
- / 
- /gold
- /silver
- /markets
- /stocks
- /currencies
- /news
- /demo
- /directory
- /marketplace
- /display
- /screen
- /store/:slug
- /pricing
- /login
- /signup
- /offline

## Authenticated merchant routes
- /dashboard
- /dashboard/account
- /dashboard/sales
- /dashboard/purchases
- /dashboard/expenses
- /dashboard/repairs
- /dashboard/buy-gold
- /dashboard/inventory
- /dashboard/accounting
- /dashboard/tax
- /dashboard/reports
- /dashboard/cameras
- /dashboard/compliance
- /dashboard/invoicing
- /dashboard/notifications
- /dashboard/integrations
- /dashboard/api-keys
- /dashboard/operations

## Platform / developer routes
- /admin (platform admin only)
- /developers

## API surface
The repository contains authenticated merchant APIs, display pairing/heartbeat/snapshot APIs, market/gold health and history APIs, Stage 3 AI/WhatsApp/billing/e-invoicing/regional APIs, payment/WhatsApp/e-invoice webhooks, API v1/v2, notifications, admin, store creation, and marketplace/Stage 2 routes.

Unknown single-segment paths are still handled by the controlled 404 behavior in app/[section]/page.tsx.

Runtime route verification must use a successful deployment; current Vercel Hobby daily deployment limits can block creation of a fresh audit deployment.
