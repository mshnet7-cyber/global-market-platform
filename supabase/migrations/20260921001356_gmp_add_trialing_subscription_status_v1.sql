-- The SaaS onboarding flow creates a seven-day trial subscription.
-- Keep the lifecycle constraint aligned with application and entitlement logic.
alter table public.gmp_subscriptions drop constraint if exists gmp_subscriptions_status_check;
alter table public.gmp_subscriptions add constraint gmp_subscriptions_status_check check (
  status = any (array['created','payment_pending','trialing','active','past_due','grace_period','expired','canceled','suspended'])
);
