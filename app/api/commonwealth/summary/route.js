import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { summarizeLeadGenerator } from "../../../../lib/commonwealthSummary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const respond = (payload, status = 200) => Response.json(payload, {
  status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
});
const digest = (input) => createHash("sha256").update(input).digest();
function authorized(value, expected) {
  return timingSafeEqual(digest(value), digest(expected));
}

export async function GET(req) {
  const secret = process.env.COMMONWEALTH_LEAD_SUMMARY_SECRET;
  const ownerId = process.env.COMMONWEALTH_LEAD_OWNER_USER_ID;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !ownerId || !url || !key) {
    return respond({ error: "Commonwealth lead integration is not configured." }, 503);
  }
  if (!authorized(req.headers.get("authorization") || "", "Bearer " + secret)) {
    return respond({ error: "Unauthorized." }, 401);
  }
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: ownerData, error: ownerError } = await db.auth.admin.getUserById(ownerId);
    const owner = ownerData?.user;
    const allowedEmails = (process.env.COMMONWEALTH_LEAD_OWNER_EMAILS || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (ownerError || !owner?.email || !owner.email_confirmed_at ||
        !allowedEmails.includes(owner.email.toLowerCase())) {
      return respond({ error: "Owner authorization unavailable." }, 403);
    }

    // Always paginate so a large campaign is not silently truncated by API row caps.
    const pageSize = 500;
    const leads = [];
    const sales = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db.from("leads")
        .select("id,audience,status,first_notice_date,second_notice_date,third_notice_date")
        .order("id").range(offset, offset + pageSize - 1);
      if (error || !data) throw new Error("Lead records unavailable.");
      leads.push(...data);
      if (data.length < pageSize) break;
    }
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db.from("sales")
        .select("id,status,job_value")
        .order("id").range(offset, offset + pageSize - 1);
      if (error || !data) throw new Error("Sales records unavailable.");
      sales.push(...data);
      if (data.length < pageSize) break;
    }
    const { data: settings, error: settingsError } = await db.from("app_settings")
      .select("follow_up_days").eq("id", 1).single();
    if (settingsError) throw new Error("Lead settings unavailable.");
    return respond(summarizeLeadGenerator({ leads, sales, followUpDays: settings?.follow_up_days }));
  } catch (error) {
    console.error("Commonwealth Lead Generator read error", error instanceof Error ? error.message : "Unknown error");
    return respond({ error: "Lead Generator summary temporarily unavailable." }, 503);
  }
}
