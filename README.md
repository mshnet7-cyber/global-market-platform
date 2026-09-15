# Global Market Platform

Free-first V1 scaffold for a global financial reference platform focused on gold, silver, FX conversion, major markets, stocks, and verified news.

## Run

1. Copy `.env.example` to `.env.local` if you want external integrations.
2. Install dependencies with `npm install`.
3. Start with `npm run dev`.

The current scaffold deliberately runs without external API keys using clearly marked demo data. It never claims demo numbers are live market data.

## Architecture

- Next.js App Router / TypeScript
- Server-first public pages
- Central snapshot API
- Multi-provider registry
- Validation/status fields
- Central caching headers
- Store/display preview
- Display route designed for long-running screens
- Supabase migration included with RLS-oriented schema
- Payment env placeholders; no automatic paid upgrade

## Important production rule

A provider is not considered production-ready merely because its API is free. Its current commercial/display/redistribution terms must be verified before showing its data to paying customers.

## Preview
`index.html` is a dependency-free browser preview. It intentionally labels sample values as DEMO and never presents them as live market data.

### Offline preflight
Run `node scripts/preflight.mjs` before `npm install`/`npm run build`. It distinguishes missing local dependencies from project source errors and never treats an unavailable npm registry as an application failure.
