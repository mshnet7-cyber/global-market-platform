# AI Engineering Team — Global Market Platform

This repository is operated with a multi-agent engineering model. The agents are roles, not independent authorities.

## Non-negotiable rules

1. Preserve Gold Engine, Price Rules, Gold Ledger, Accounting, Auth, RLS, RPC and tenant-isolation behavior unless a verified defect requires a change.
2. No financial, inventory, tax, authentication or authorization change is accepted without tests and regression verification.
3. Presentation changes must remain isolated from business logic.
4. Every change follows: inspect → plan → implement → test → lint → build → security/data checks → review → deploy → runtime verify.
5. Never call a deployment successful because a GitHub check passed. Verify the actual deployment commit and runtime.
6. Never use an older READY deployment as evidence for a newer commit.
7. Never manufacture credentials, test results, deployment status or browser results.
8. Temporary database tests must run in rollback-safe transactions and leave no synthetic production data.
9. AI may recommend or prepare sensitive operations, but deterministic server-side rules remain authoritative for money, gold, inventory, tax and permissions.
10. When blocked, classify the blocker as CODE, CONFIGURATION, CREDENTIALS, EXTERNAL PROVIDER, MANUAL ACTION, or TOOL LIMITATION.

## Team roles

- Architect: protects module boundaries and the platform baseline.
- Product/Domain: Gold Market, Gold Shop SaaS, POS, inventory, buyback, exchange, repair, workshop.
- Frontend/UX: responsive RTL/LTR UI, typography, themes, accessibility.
- Backend: APIs, RPCs, workflows, idempotency and server-side authorization.
- Database/Supabase: migrations, RLS, constraints, indexes and integrity.
- Accounting/Tax: ledger, VAT, e-invoicing and reconciliation.
- Security: Auth, RLS, tenant isolation, operation-level authorization and audit.
- QA: unit, integration, regression, E2E and browser validation.
- DevOps: GitHub CI, Vercel, Cloudflare, environments and runtime health.
- Release Manager: verifies all gates before declaring release readiness.

## Mac Studio M5 operating model

The Mac is the local execution workstation. The repository remains the source of truth. Local agents must work in isolated branches/worktrees and submit reviewable commits. Secrets stay in environment managers and are never committed.

Recommended local gates:

`npm ci`
`npm test`
`npm run lint`
`npm run build`
`npm run verify`

For database work, use a dedicated test project or rollback-safe transactions. For browser work, use a real browser automation runner and capture the tested commit/deployment URL.

## Definition of done

LATEST COMMIT → CI PASS → DEPLOYMENT MATCHES COMMIT → RUNTIME PASS → CRITICAL USER JOURNEYS PASS → SECURITY PASS → RELEASE.

A green CI pipeline alone is not production readiness.
