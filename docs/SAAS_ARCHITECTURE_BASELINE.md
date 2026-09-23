# Global Market Platform — SaaS Architecture Baseline

## Product
Global Gold & Precious Metals Market + Gold Intelligence + Gold Shop Operating SaaS + POS + Gold Operations + Accounting + E-Invoicing/Tax + AI + Integrations.

## SaaS boundaries
- Multi-tenant organizations with tenant isolation.
- Branches, stores, users, roles and operation-level permissions.
- Subscription, plan and trial enforcement.
- Public market surfaces are separate from private merchant workspaces.
- Financial and gold ledgers remain auditable and deterministic.

## Core modules
Gold Engine, Price Rules, Gold Ledger, POS, Inventory, Purchases, Buyback, Exchange, Repairs, Workshop/Manufacturing, Customer 360, Supplier 360, Accounting Ledger, Tax Engine, E-Invoicing, AI, WhatsApp, Omnichannel, Marketplace, Displays, Documents, Workflows, Integrations, Observability and Platform Administration.

## Architecture principles
1. Modular boundaries first.
2. Market price is separated from merchant sell price.
3. Gold Ledger and Accounting Ledger are separate but reconciled.
4. Sensitive operations are event-driven and idempotent.
5. AI assists; deterministic business rules own money, inventory, tax and accounting.
6. Operation-level authorization is required for sensitive actions.
7. Approval workflows protect high-risk actions.
8. APIs are first-class contracts for web, POS, mobile and integrations.
9. Tax is provider/rule driven so Oman is the first implementation, not a hard-coded global assumption.
10. Offline POS is designed as a controlled future capability with conflict-safe synchronization.
11. Documents, audit evidence and observability are first-class platform concerns.
12. Feature flags enable staged releases without branching business logic.

## UX baseline
- Responsive desktop/tablet/mobile.
- RTL/LTR.
- Arabic, English, Turkish and German.
- Dark/light themes.
- Accessible font scaling and keyboard focus.
- Consistent SaaS page headers, cards, tables, forms and status patterns.
- Financial numbers use tabular Latin digits where required by the product specification.

## Change policy
Do not alter pricing, authentication, RLS, RPC, trial logic, accounting logic, price logic or APIs for visual work. Any functional change must be independently justified, tested and regression-verified.
