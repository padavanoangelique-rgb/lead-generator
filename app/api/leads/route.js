import { staffClient } from "../../../lib/staffAuth";
import { cleanLead } from "../../../lib/leadFields";

export const dynamic = "force-dynamic";
const response = (value, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (status, message) => response({ error: message }, status);
const uuid = (id) => typeof id === "string" && /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id);

async function authorized(req) {
  try { return { db: await staffClient(req) }; }
  catch (error) { return { failed: fail(error.status || 500, error.message || "Access denied") }; }
}

export async function GET(req) {
  const { db, failed } = await authorized(req);
  if (failed) return failed;
  const { data, error } = await db.from("leads").select("*").order("created_at", { ascending: false });
  if (error) return fail(503, "Could not load leads.");
  return response({ leads: data || [] });
}

export async function POST(req) {
  const { db, failed } = await authorized(req);
  if (failed) return failed;
  const body = await req.json().catch(() => null);
  const provided = Array.isArray(body?.leads) ? body.leads : [body?.lead || body];
  if (!provided.length || provided.length > 100) return fail(400, "Upload between 1 and 100 leads at a time.");

  const rows = provided.map(cleanLead).map((row) => ({
    ...row,
    name: String(row.name || "").trim().slice(0, 250),
    address: String(row.address || "").trim().slice(0, 400),
    audience: row.audience || "homeowner",
  }));
  if (rows.some((row) => !row.name || !row.address)) return fail(400, "Each lead requires a name and address.");
  const { data, error } = await db.from("leads").insert(rows).select();
  if (error) return fail(400, "Could not save leads. Review duplicates and required fields.");
  return response({ leads: data || [] });
}

export async function PATCH(req) {
  const { db, failed } = await authorized(req);
  if (failed) return failed;
  const body = await req.json().catch(() => null);
  if (!uuid(body?.id)) return fail(400, "Valid lead ID required.");
  const fields = cleanLead(body.fields || {});
  if (!Object.keys(fields).length) return fail(400, "No changes provided.");
  const { data, error } = await db.from("leads").update(fields).eq("id", body.id).select().single();
  if (error || !data) return fail(400, "Could not update lead.");
  return response({ lead: data });
}

export async function PUT(req) {
  const { db, failed } = await authorized(req);
  if (failed) return failed;
  const body = await req.json().catch(() => null);
  const leadId = body?.sale?.lead_id;
  if (!uuid(leadId)) return fail(400, "Select a valid lead before conversion.");
  const value = Number(body?.sale?.job_value ?? 0);
  if (!Number.isFinite(value) || value < 0 || value > 99999999) return fail(400, "Invalid job value.");
  const { data: lead, error: leadError } = await db.from("leads")
    .select("id,name,permit_number,audience").eq("id", leadId).maybeSingle();
  if (leadError || !lead) return fail(404, "Lead not found.");

  const { data: existing, error: lookupError } = await db.from("sales")
    .select("*").eq("lead_id", leadId).maybeSingle();
  if (lookupError) return fail(503, "Could not verify existing conversion.");
  if (existing) return response({ sale: existing, alreadyConverted: true });

  const sale = {
    lead_id: leadId,
    job_name: lead.permit_number
      ? lead.name + " — Permit #" + lead.permit_number
      : lead.name + " — " + (lead.audience || "Lead"),
    job_value: Math.round(value * 100) / 100,
    status: "in_progress",
    converted_date: new Date().toISOString().slice(0, 10),
  };
  const { data: created, error: insertError } = await db.from("sales").insert(sale).select().single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: reused } = await db.from("sales").select("*").eq("lead_id", leadId).maybeSingle();
      if (reused) return response({ sale: reused, alreadyConverted: true });
    }
    return fail(400, "Could not convert lead into sale.");
  }
  const { error: statusError } = await db.from("leads").update({ status: "converted" }).eq("id", leadId);
  return response({ sale: created, warning: statusError ? "Sale saved but lead status needs updating." : undefined });
}
