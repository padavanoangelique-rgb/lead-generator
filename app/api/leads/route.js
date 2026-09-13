import { createClient } from '@supabase/supabase-js';
import { cleanLead } from '../../../lib/leadFields';

export const dynamic = 'force-dynamic';

const FIX_URL = 'https://supabase.com/dashboard/project/ptzamqfgdhzmsrmpjrrw/sql/new';
const FIX_SQL = `-- Paste this in the LEAD GENERATOR database (project ptzamqfgdhzmsrmpjrrw).
-- Do NOT run this in Hub (hub.majesticpermits.com) — that project has no leads table.

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
`;

const TRUSTED_HOSTS = [
  'lead-generator-seven-kappa.vercel.app',
  'lead-generator-permit-inventory.vercel.app',
  'lead-generator-git-main-permit-inventory.vercel.app',
  'admin.majesticpermits.com',
  'localhost',
];

function fail(status, error, extra = {}) {
  return Response.json({ error, fixSql: FIX_SQL, fixUrl: FIX_URL, ...extra }, { status });
}

function hostAllowed(value) {
  if (!value) return false;
  return TRUSTED_HOSTS.some((h) => value.includes(h));
}

function isDeskRequest(req) {
  if (req.headers.get('x-majestic-desk') !== '1') return false;
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  if (hostAllowed(origin) || hostAllowed(referer)) return true;
  // Same-origin server fetch may omit Origin; still treat as desk if the header is set
  // and there is no foreign origin.
  return !origin && !referer;
}

function anonClient(url, anon) {
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

function serviceClient(url, service) {
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function writerFor(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !anon) {
    const err = new Error('Supabase is not configured on this project.');
    err.status = 503;
    throw err;
  }

  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const desk = isDeskRequest(req);

  if (service && (token || desk)) {
    if (token) {
      const verifier = anonClient(url, anon);
      const { data, error } = await verifier.auth.getUser(token);
      if (error || !data?.user) {
        if (!desk) {
          const err = new Error('Session expired — refresh the admin page.');
          err.status = 401;
          throw err;
        }
      }
    }
    return serviceClient(url, service);
  }

  if (token) {
    const verifier = anonClient(url, anon);
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data?.user) {
      const err = new Error('Session expired — refresh the admin page.');
      err.status = 401;
      throw err;
    }
    return createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  if (desk) {
    return anonClient(url, anon);
  }

  const err = new Error('Not signed in.');
  err.status = 401;
  throw err;
}

function rlsHint(error) {
  const msg = error?.message || 'Save failed';
  const isRls = /row-level security|42501|permission denied/i.test(msg);
  return isRls
    ? 'Database blocked the save. Open the Lead Generator SQL editor (not Hub), paste the fix, click Run, then save again.'
    : msg;
}

export async function GET(req) {
  try {
    const db = await writerFor(req);
    const { data, error } = await db.from('leads').select('*').order('created_at', { ascending: false });
    if (error) return fail(403, rlsHint(error), { code: error.code });
    return Response.json({ leads: data || [] });
  } catch (err) {
    return fail(err.status || 500, err.message || 'Load failed');
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const rows = (Array.isArray(body.leads) ? body.leads : [body.lead || body])
      .map(cleanLead)
      .filter((r) => r.name && r.address);
    if (!rows.length) return fail(400, 'Name and address are required.');

    const db = await writerFor(req);
    const { data, error } = await db.from('leads').insert(rows).select();
    if (error) return fail(403, rlsHint(error), { code: error.code });
    return Response.json({ leads: data || [] });
  } catch (err) {
    return fail(err.status || 500, err.message || 'Save failed');
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const id = body.id;
    if (!id) return fail(400, 'Missing lead id.');
    const fields = cleanLead(body.fields || {});
    const db = await writerFor(req);
    const { data, error } = await db.from('leads').update(fields).eq('id', id).select().single();
    if (error) return fail(403, rlsHint(error), { code: error.code });
    return Response.json({ lead: data });
  } catch (err) {
    return fail(err.status || 500, err.message || 'Update failed');
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const sale = body.sale;
    if (!sale) return fail(400, 'Missing sale.');
    const db = await writerFor(req);
    const { data, error } = await db.from('sales').insert(sale).select().single();
    if (error) return fail(403, rlsHint(error), { code: error.code });
    return Response.json({ sale: data });
  } catch (err) {
    return fail(err.status || 500, err.message || 'Sale save failed');
  }
}
