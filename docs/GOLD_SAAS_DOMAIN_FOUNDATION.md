# Gold SaaS Domain Foundation

This branch starts the functional expansion from the existing merchant ERP into the gold-specific operating system.

## What already exists

The platform already has a substantial merchant foundation: organizations/tenants, stores and branches, subscriptions and entitlements, POS/sales, purchases, expenses, customers/suppliers, inventory, accounting journals, tax/compliance, invoicing/e-invoicing foundations, marketplace, displays, WhatsApp retry/idempotency, AI/OCR job foundations, APIs, audit/observability and security hardening.

## The gap identified

The existing ERP records gold-related fields such as karat, weight and making charges in several transaction paths, but there was not yet a single first-class physical-gold ledger that answers:

- How many grams of each karat does a store own?
- How much pure-gold equivalent is that stock?
- Which operation changed the gold balance?
- Which sale/purchase/buyback/exchange/manufacturing/repair operation produced the movement?
- Can the movement be safely retried without duplicating gold?

Accounting and gold are related but not interchangeable. Accounting tracks money and financial value; the Gold Ledger tracks the physical metal.

## This increment

1. gmp_gold_ledger_entries is an immutable, tenant-scoped physical-gold movement ledger.
2. It stores gross, stone and net weight, karat and a deterministic pure-gold-weight calculation.
3. It supports the gold operation vocabulary needed by POS, purchases, buyback, exchange, manufacturing, repairs and adjustments.
4. It is idempotent at the organization level.
5. It exposes a derived store/karat balance view.
6. gmp_gold_price_rules establishes the database contract for store/org gold buy/sell adjustments without replacing the existing market-price engine.
7. A controlled RPC validates and posts one ledger movement; integration into existing sale/purchase workflows is intentionally the next increment so we do not create a second source of truth accidentally.

## Next functional increments

- Wire POS sale and purchase RPCs to the Gold Ledger atomically.
- Add buyback and exchange workflows using the same ledger.
- Add workshop/manufacturing conversion and waste accounting.
- Add operation-level permissions and approval thresholds.
- Connect Shop Price calculation to Market Price → Price Rules → Shop Price.
- Add gold inventory reports and reconciliation against the Accounting Ledger.
