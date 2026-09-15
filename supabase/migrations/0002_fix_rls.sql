drop policy if exists org_member_read_members on public.organization_members;
create policy org_member_read_members on public.organization_members
for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.organization_members viewer
    where viewer.organization_id = organization_members.organization_id
      and viewer.user_id = auth.uid()
      and viewer.role in ('owner','admin')
  )
);

alter table public.screen_pairing_codes force row level security;
alter table public.screen_sessions force row level security;

create policy pairing_code_no_client_read on public.screen_pairing_codes
for select using (false);

create policy screen_session_no_client_read on public.screen_sessions
for select using (false);
