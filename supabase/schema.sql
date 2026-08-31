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
alter table leads enable row level security;
alter table sales enable row level security;
alter table transactions enable row level security;
alter table app_settings enable row level security;

create policy "authenticated read leads" on leads for select using (auth.role() = 'authenticated');
create policy "authenticated write leads" on leads for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated read sales" on sales for select using (auth.role() = 'authenticated');
create policy "authenticated write sales" on sales for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated read transactions" on transactions for select using (auth.role() = 'authenticated');
create policy "authenticated write transactions" on transactions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated read settings" on app_settings for select using (auth.role() = 'authenticated');
create policy "authenticated write settings" on app_settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- To add a column later, run something like this as its own snippet:
--   ALTER TABLE leads ADD COLUMN IF NOT EXISTS some_new_field text default '';
