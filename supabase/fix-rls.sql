-- Run in the LEAD GENERATOR database only:
-- https://supabase.com/dashboard/project/ptzamqfgdhzmsrmpjrrw/sql/new
-- Do NOT run this in Hub (hub.majesticpermits.com).

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on table public.leads to authenticated, anon;
grant select, insert, update, delete on table public.sales to authenticated, anon;
grant select, insert, update, delete on table public.transactions to authenticated, anon;
grant select, insert, update, delete on table public.app_settings to authenticated, anon;

drop policy if exists "authenticated read leads" on public.leads;
drop policy if exists "authenticated write leads" on public.leads;
drop policy if exists "staff read leads" on public.leads;
drop policy if exists "staff insert leads" on public.leads;
drop policy if exists "staff update leads" on public.leads;
drop policy if exists "staff delete leads" on public.leads;
create policy "staff read leads" on public.leads for select to authenticated, anon using (true);
create policy "staff insert leads" on public.leads for insert to authenticated, anon with check (true);
create policy "staff update leads" on public.leads for update to authenticated, anon using (true) with check (true);
create policy "staff delete leads" on public.leads for delete to authenticated, anon using (true);

drop policy if exists "authenticated read sales" on public.sales;
drop policy if exists "authenticated write sales" on public.sales;
drop policy if exists "staff read sales" on public.sales;
drop policy if exists "staff insert sales" on public.sales;
drop policy if exists "staff update sales" on public.sales;
drop policy if exists "staff delete sales" on public.sales;
create policy "staff read sales" on public.sales for select to authenticated, anon using (true);
create policy "staff insert sales" on public.sales for insert to authenticated, anon with check (true);
create policy "staff update sales" on public.sales for update to authenticated, anon using (true) with check (true);
create policy "staff delete sales" on public.sales for delete to authenticated, anon using (true);

drop policy if exists "authenticated read transactions" on public.transactions;
drop policy if exists "authenticated write transactions" on public.transactions;
drop policy if exists "staff read transactions" on public.transactions;
drop policy if exists "staff insert transactions" on public.transactions;
drop policy if exists "staff update transactions" on public.transactions;
drop policy if exists "staff delete transactions" on public.transactions;
create policy "staff read transactions" on public.transactions for select to authenticated, anon using (true);
create policy "staff insert transactions" on public.transactions for insert to authenticated, anon with check (true);
create policy "staff update transactions" on public.transactions for update to authenticated, anon using (true) with check (true);
create policy "staff delete transactions" on public.transactions for delete to authenticated, anon using (true);

drop policy if exists "authenticated read settings" on public.app_settings;
drop policy if exists "authenticated write settings" on public.app_settings;
drop policy if exists "staff read settings" on public.app_settings;
drop policy if exists "staff write settings" on public.app_settings;
create policy "staff read settings" on public.app_settings for select to authenticated, anon using (true);
create policy "staff write settings" on public.app_settings for all to authenticated, anon using (true) with check (true);
