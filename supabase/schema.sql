-- The Permit Closer — schema
-- Run in Supabase SQL Editor: Project -> SQL Editor -> New query -> paste -> Run.

create extension if not exists "uuid-ossp";

-- ---------- Leads (one row per property/permit, or per referral-partner contact) ----------
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),

  -- homeowner | realtor_broker | property_manager | title_company
  -- Determines which letter template is used and which fields are shown in the UI.
  audience text not null default 'homeowner',

  name text not null default '',
  address text not null default '',
  county text not null default '',
  permit_number text not null default '',
  permit_type text not null default 'Building',
  date_issued text not null default '',
  date_expired text not null default '',
  contact text not null default '',
  email text not null default '',
  notes text not null default '',

  -- Outreach tracking — date each touch was actually printed/sent.
  -- For "homeowner" these are the 1st/2nd/3rd expired-permit notices;
  -- for partner audiences these are the intro + two lighter-touch follow-ups.
  first_notice_date date,
  second_notice_date date,
  third_notice_date date,

  -- pending | due_second | due_third | closed | converted
  status text not null default 'pending',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists leads_audience_idx on leads (audience);

-- ---------- Sales (a lead converted into an actual job) ----------
create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete set null,
  job_name text not null default '',
  job_value numeric(10,2) not null default 0,
  status text not null default 'in_progress', -- in_progress | completed | lost
  converted_date date not null default current_date,
  notes text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Transactions (money in / money out, per job or standalone) ----------
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references sales(id) on delete set null,
  type text not null, -- income | expense
  category text not null default '',
  amount numeric(10,2) not null default 0,
  txn_date date not null default current_date,
  description text not null default '',
  created_at timestamptz default now()
);

-- ---------- Settings (single row, key/value-ish for simple app config) ----------
create table if not exists app_settings (
  id int primary key default 1,
  postage_rate numeric(6,3) not null default 0.78,  -- USPS First-Class letter rate, editable
  follow_up_days int not null default 60,
  constraint single_row check (id = 1)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ---------- updated_at triggers ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated on leads;
create trigger trg_leads_updated before update on leads
  for each row execute procedure set_updated_at();

drop trigger if exists trg_sales_updated on sales;
create trigger trg_sales_updated before update on sales
  for each row execute procedure set_updated_at();

-- ---------- RLS ----------
-- Apply to the Lead Generator database before enabling Commonwealth embedding.
-- Replace the owner email below with the verified owner/staff emails used for login.
BEGIN;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='leads' LOOP EXECUTE format('DROP POLICY %I ON public.leads',p.policyname); END LOOP; END $$;
CREATE POLICY commonwealth_staff ON public.leads FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com')) WITH CHECK (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com'));
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sales' LOOP EXECUTE format('DROP POLICY %I ON public.sales',p.policyname); END LOOP; END $$;
CREATE POLICY commonwealth_staff ON public.sales FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com')) WITH CHECK (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com'));
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transactions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='transactions' LOOP EXECUTE format('DROP POLICY %I ON public.transactions',p.policyname); END LOOP; END $$;
CREATE POLICY commonwealth_staff ON public.transactions FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com')) WITH CHECK (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com'));
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' LOOP EXECUTE format('DROP POLICY %I ON public.app_settings',p.policyname); END LOOP; END $$;
CREATE POLICY commonwealth_staff ON public.app_settings FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com')) WITH CHECK (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com'));
COMMIT;
