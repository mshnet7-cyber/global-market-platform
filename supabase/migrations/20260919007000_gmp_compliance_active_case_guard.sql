create unique index if not exists gmp_compliance_active_entity_uniq
on public.gmp_compliance_cases (organization_id, entity_type, entity_id)
where entity_id is not null and status in ('open','under_review','submitted');