import { getAccessToken } from './supabaseClient';
import { cleanLead } from './leadFields';

export { cleanLead } from './leadFields';

async function deskFetch(path, method, body) {
  const token = await getAccessToken();
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `Save failed (${res.status})`);
    err.code = json.code;
    err.fixSql = json.fixSql;
    err.fixUrl = json.fixUrl;
    throw err;
  }
  return json;
}

export async function saveLeads(rows) {
  const list = (Array.isArray(rows) ? rows : [rows]).map(cleanLead);
  const json = await deskFetch('/api/leads', 'POST', { leads: list });
  return json.leads || [];
}

export async function updateLead(id, fields) {
  const json = await deskFetch('/api/leads', 'PATCH', { id, fields: cleanLead(fields) });
  return json.lead;
}

export async function insertSale(fields) {
  const json = await deskFetch('/api/leads', 'PUT', { sale: fields });
  return json.sale;
}
