# Review status

The project is now aligned to the approved merchant MVP scope.

Public MVP: gold, silver, currencies, news, shop discovery and advertising. Stocks and generic Markets are not exposed publicly.

Merchant foundation: multi-tenant organizations, branches/stores, plans and pricing, products, sales/POS foundation, purchases with human review fields, expenses, repairs, person-to-person gold purchases, private documents, and transaction review/audit records.

Security baseline: RLS enabled on merchant MVP tables, sensitive identity documents restricted to authenticated owner/admin roles, new foreign-key indexes added, and auth.uid() wrapped for RLS query efficiency.

Current deployment baseline: Vercel production build previously completed successfully on commit 94ba35d. New scope changes require the next deployment to complete before final runtime verification.

Preview authentication hardening: demo access is server-only; the browser cannot use a forgeable demo-role header or anonymous demo RPC execution. Demo role headers are injected only by trusted server-side clients after credential/session checks.

Intentional Supabase advisor warning: the five atomic merchant transaction RPCs remain SECURITY DEFINER because they perform privileged multi-table transactional work. Application-layer merchant authorization and tenant checks remain mandatory; anonymous EXECUTE has been revoked.

Known external blockers: production Supabase environment variables must be configured for authenticated health checks; payment provider/checkout and official government e-invoicing integrations are not yet configured; Supabase Auth leaked-password protection still requires enabling in the project Auth settings. These are intentionally not faked.
