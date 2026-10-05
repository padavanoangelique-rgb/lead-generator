import { staffClient } from '../../../lib/staffAuth';
import { cleanLead } from '../../../lib/leadFields';

export const dynamic = 'force-dynamic';

function fail(status,error,extra={}) {return Response.json({error,...extra},{status});}
async function writerFor(req){return staffClient(req);}
function rlsHint(error) {
  const msg = error?.message || 'Save failed';
  const isRls = /row-level security|42501|permission denied/i.test(msg);
  return isRls
    ? 'Database access is blocked. Ask the owner to review staff access policies.'
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
