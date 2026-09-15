create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null unique,
  phone text,
  whatsapp text,
  logo_path text,
  country_code text not null default 'OM',
  currency text not null default 'OMR',
  timezone text not null default 'Asia/Muscat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.screens (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  template text not null default 'classic' check (template in ('classic','modern','premium')),
  status text not null default 'unpaired' check (status in ('unpaired','pairing','connected','offline','revoked','expired')),
  last_seen_at timestamptz,
  last_snapshot_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.screen_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.screens(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists one_active_pairing_code on public.screen_pairing_codes(screen_id) where consumed_at is null;

create table if not exists public.screen_sessions (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.screens(id) on delete cascade,
  session_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('starter','pro','business')),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  plan_id uuid primary key references public.plans(id) on delete cascade,
  max_stores integer not null,
  max_screens integer not null,
  analytics boolean not null default false,
  alerts boolean not null default false,
  members boolean not null default false
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null check (status in ('created','payment_pending','active','past_due','grace_period','expired','canceled')),
  provider text,
  external_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans(code,name) values
  ('starter','Starter'),('pro','Pro'),('business','Business')
on conflict (code) do nothing;

insert into public.plan_entitlements(plan_id,max_stores,max_screens,analytics,alerts,members)
select id,1,1,false,false,false from public.plans where code='starter'
on conflict (plan_id) do update set max_stores=excluded.max_stores,max_screens=excluded.max_screens,analytics=excluded.analytics,alerts=excluded.alerts,members=excluded.members;
insert into public.plan_entitlements(plan_id,max_stores,max_screens,analytics,alerts,members)
select id,1,10,true,true,false from public.plans where code='pro'
on conflict (plan_id) do update set max_stores=excluded.max_stores,max_screens=excluded.max_screens,analytics=excluded.analytics,alerts=excluded.alerts,members=excluded.members;
insert into public.plan_entitlements(plan_id,max_stores,max_screens,analytics,alerts,members)
select id,50,250,true,true,true from public.plans where code='business'
on conflict (plan_id) do update set max_stores=excluded.max_stores,max_screens=excluded.max_screens,analytics=excluded.analytics,alerts=excluded.alerts,members=excluded.members;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.stores enable row level security;
alter table public.screens enable row level security;
alter table public.screen_pairing_codes enable row level security;
alter table public.screen_sessions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;

create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy org_member_read on public.organizations for select using (exists(select 1 from public.organization_members m where m.organization_id=id and m.user_id=auth.uid()));
create policy org_owner_write on public.organizations for update using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy org_member_read_members on public.organization_members for select using (user_id=auth.uid() or exists(select 1 from public.organization_members m where m.organization_id=organization_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
create policy stores_member_access on public.stores for all using (exists(select 1 from public.organization_members m where m.organization_id=stores.organization_id and m.user_id=auth.uid())) with check (exists(select 1 from public.organization_members m where m.organization_id=stores.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
create policy screens_store_access on public.screens for all using (exists(select 1 from public.stores s join public.organization_members m on m.organization_id=s.organization_id where s.id=screens.store_id and m.user_id=auth.uid())) with check (exists(select 1 from public.stores s join public.organization_members m on m.organization_id=s.organization_id where s.id=screens.store_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
create policy plans_public_read on public.plans for select using (true);
create policy entitlements_public_read on public.plan_entitlements for select using (true);
create policy subscriptions_member_read on public.subscriptions for select using (exists(select 1 from public.organization_members m where m.organization_id=subscriptions.organization_id and m.user_id=auth.uid()));
