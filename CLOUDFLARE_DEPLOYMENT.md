# Cloudflare Workers deployment

This repository keeps the existing Next.js/Vercel path and adds a parallel Cloudflare Workers target.

## One-time Cloudflare setup

1. Create or use a Cloudflare account and enable a Workers project.
2. Create an API token with permission to deploy Workers for the target account.
3. In GitHub repository settings, add these Actions secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Merge the Cloudflare deployment PR into `main`.
5. The workflow `.github/workflows/cloudflare-deploy.yml` will install dependencies, run `vinext check`, and deploy with `vinext-cloudflare deploy`.

## Application secrets

Set the same server-side application secrets that the existing deployment requires, including the Supabase keys and any enabled provider credentials. Keep server-only secrets out of `NEXT_PUBLIC_*` variables and never commit `.env`.

The Cloudflare Worker uses the existing two cron jobs through the Worker `scheduled` handler. Set `CRON_SECRET` (or the existing `GMP_CRON_SECRET` compatibility name) in the Cloudflare Worker environment.

## Verification

Before production adoption:

`npm run test`

`npm run check:vinext`

`npm run build:vinext`

`npm run deploy:cloudflare:dry-run`

The dry-run generates and validates the Cloudflare deployment configuration without publishing the Worker. The current Cloudflare branch has passed all of these checks in GitHub Actions. A real production deployment still requires the Cloudflare account credentials above.
