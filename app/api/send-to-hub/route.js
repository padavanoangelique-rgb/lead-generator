import { staffClient } from "../../../lib/staffAuth";

export const dynamic = "force-dynamic";
const respond = (payload, status = 200) =>
  Response.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
const uuid = (id) => typeof id === "string" &&
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id);

export async function POST(req) {
  let db;
  try {
    db = await staffClient(req);
  } catch (err) {
    return respond({ error: err.message || "Access denied." }, err.status || 401);
  }

  const body = await req.json().catch(() => null);
  if (!uuid(body?.sale_id)) return respond({ error: "Select a valid converted sale." }, 400);

  const { data: sale, error: lookupError } = await db
    .from("sales")
    .select("id,lead_id,job_name,job_value,hub_job_id,leads(id,audience,name,address,email,contact,permit_number,permit_type,county,notes)")
    .eq("id", body.sale_id)
    .maybeSingle();
  if (lookupError || !sale) return respond({ error: "Sale not found." }, 404);

  if (sale.hub_job_id) {
    return respond({
      id: sale.hub_job_id,
      url: "https://hub.majesticpermits.com/admin/jobs/" + sale.hub_job_id,
      reused: true
    });
  }

  const lead = sale.leads;
  if (!lead || !lead.id) return respond({ error: "Original lead is missing." }, 422);
  if (lead.audience === "contractor_permitaio") {
    return respond({
      error: "PermitAIO software leads must enter PermitAIO onboarding, not a Majestic permit job."
    }, 422);
  }

  const isHomeowner = !lead.audience || lead.audience === "homeowner";
  // A referral partner's business mailing address is not a permitted job site.
  const override = typeof body?.project_address === "string" ? body.project_address.trim() : "";
  if (!isHomeowner && override.length < 5) {
    return respond({
      error: "Enter the actual project property address before creating a job from a referral or contractor lead."
    }, 422);
  }
  const address = override || String(lead.address || "").trim();
  if (address.length < 5) return respond({ error: "Project property address is required." }, 400);

  const secret = process.env.HUB_INGEST_SECRET || process.env.LEAD_INGEST_SECRET;
  const hubBase = (process.env.HUB_URL || "https://hub.majesticpermits.com").replace(/\/$/, "");
  if (!secret) return respond({ error: "Hub connection is not configured." }, 503);

  try {
    const r = await fetch(hubBase + "/api/ingest/lead-generator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + secret,
      },
      cache: "no-store",
      body: JSON.stringify({
        source_sale_id: sale.id,
        source_lead_id: sale.lead_id,
        brand: lead.audience === "contractor_majestic" ? "Majestic Permits" : "The Permit Closer",
        name: lead.name || sale.job_name,
        address,
        email: lead.email || "",
        phone: lead.contact || "",
        permit_number: isHomeowner ? lead.permit_number || "" : "",
        permit_type: isHomeowner ? lead.permit_type || "" : "Permit service",
        county: lead.county || "",
        notes: lead.notes || "",
        job_value: sale.job_value || 0,
      }),
    });
    const result = await r.json().catch(() => ({}));
    if (!r.ok || !uuid(result.id)) {
      return respond({ error: result.error || "Majestic Hub did not accept this sale." }, r.status >= 400 ? r.status : 502);
    }
    const { error: updateError } = await db.from("sales").update({
      hub_job_id: result.id,
      hub_synced_at: new Date().toISOString(),
    }).eq("id", sale.id);
    return respond({
      id: result.id,
      url: result.url || hubBase + "/admin/jobs/" + result.id,
      reused: Boolean(result.reused),
      warning: updateError ? "Job created, but the sales link could not be saved. Retrying is safe." : result.warning,
    });
  } catch {
    return respond({ error: "Hub request failed. Retry; the original sale ID prevents duplicate jobs." }, 502);
  }
}
