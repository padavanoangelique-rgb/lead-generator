-- Secure the Lead Generator data without deleting or rewriting existing leads,
-- sales, transactions or settings. Run as a migration using an owner account.
begin;

create table if not exists public.lead_generator_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);
alter table public.lead_generator_staff enable row level security;
revoke all on table public.lead_generator_staff from anon, public;
grant select on table public.lead_generator_staff to authenticated;
drop policy if exists "Self can read approved staff role" on public.lead_generator_staff;
create policy "Self can read approved staff role"
  on public.lead_generator_staff for select to authenticated
  using (user_id = auth.uid());

insert into public.lead_generator_staff(user_id,role)
select id,'owner'
from auth.users
where lower(email) = 'angelique@majesticpermits.com'
  and email_confirmed_at is not null
on conflict(user_id) do update set role = 'owner';

do $$
begin
  if not exists(select 1 from public.lead_generator_staff where role='owner') then
    raise exception 'Verified lead generator owner must exist; access policy migration aborted';
  end if;
end $$;

do $$
declare tbl text; p record;
begin
  foreach tbl in array array['leads','sales','transactions','app_settings'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on table public.%I from anon, public',tbl);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',tbl);
    for p in select policyname from pg_policies where schemaname='public' and tablename=tbl loop
      execute format('drop policy if exists %I on public.%I',p.policyname,tbl);
    end loop;
    execute format(
      'create policy "Authorized Lead Generator staff only" on public.%I for all to authenticated ' ||
      'using (exists (select 1 from public.lead_generator_staff lg where lg.user_id=auth.uid())) ' ||
      'with check (exists (select 1 from public.lead_generator_staff lg where lg.user_id=auth.uid()))',
      tbl
    );
  end loop;
end $$;

-- One sale per source lead. Existing duplicate groups must be reviewed
-- before enabling this unique index.
do $$
begin
  if exists(select 1 from (select lead_id from public.sales
                           where lead_id is not null group by lead_id having count(*)>1) duplicates) then
    raise exception 'Existing duplicate sales need review before enforcing uniqueness';
  end if;
end $$;
create unique index if not exists sales_lead_once_idx
  on public.sales (lead_id) where lead_id is not null;

-- Keep the old notes/relationships. These nullable fields hold a verified
-- link back to the original Majestic Hub job after successful conversion.
alter table public.sales add column if not exists hub_job_id uuid;
alter table public.sales add column if not exists hub_synced_at timestamptz;

commit;
