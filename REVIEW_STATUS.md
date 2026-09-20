# Review status

The project is now aligned to the approved merchant MVP scope.

Public MVP: gold, silver, currencies, news, shop discovery and advertising. Stocks and generic Markets are not exposed publicly.

Merchant foundation: multi-tenant organizations, branches/stores, plans and pricing, products, sales/POS foundation, purchases with human review fields, expenses, repairs, person-to-person gold purchases, private documents, and transaction review/audit records.

Security baseline: RLS enabled on merchant MVP tables, sensitive identity documents restricted to authenticated owner/admin roles, new foreign-key indexes added, and auth.uid() wrapped for RLS query efficiency. Browser state-changing routes enforce same-origin requests, and anonymous DML on GMP tables is revoked at the database layer.

Deployment status: the latest branch contains the current security hardening, but Vercel is currently rate-limiting new builds (`build-rate-limit`). The last known READY Vercel deployment predates the latest hardening, so final runtime verification on the newest commit is still pending.

Preview authentication hardening: demo access is server-only; demo credentials are checked before a session is issued, the demo session cookie is HMAC-signed, anonymous demo RPC execution is revoked, and the five Stage 2 transaction RPCs accept the demo-role actor override only when the PostgREST caller role is `service_role`. Real authenticated callers fall back to `auth.uid()`. Demo role headers are injected only by trusted server-side clients after credential/session checks.

Intentional Supabase advisor warning: the five atomic merchant transaction RPCs remain SECURITY DEFINER because they perform privileged multi-table transactional work. They use `search_path=public`, require authenticated owner/admin membership for normal calls, and permit the seeded Preview Demo actor override only for `service_role`. Anonymous EXECUTE has been revoked; the remaining authenticated EXECUTE is deliberate for real merchant transactions.

Known external blockers: production Supabase environment variables must be configured for authenticated health checks; payment provider/checkout and official government e-invoicing integrations are not yet configured; Supabase Auth leaked-password protection still requires enabling in the project Auth settings. These are intentionally not faked.
