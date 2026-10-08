// Aggregate the existing, separate PermitCloser Lead Generator database.
// The Commonwealth receives counts only; original lead/sale/job records stay where they are.
export const LEAD_AUDIENCES = Object.freeze({
  homeowner: "Homeowners · expired permits",
  realtor_broker: "Realtors & brokers",
  property_manager: "Property managers",
  title_company: "Title companies",
  contractor_permitaio: "Contractors · PermitAIO",
  contractor_majestic: "Contractors · Majestic",
});

function validDay(raw) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  const iso = raw.slice(0, 10);
  const time = Date.parse(iso + "T00:00:00.000Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso ? time : null;
}
function ageDays(raw, todayMs) {
  const ms = validDay(raw);
  return ms === null ? null : Math.floor((todayMs - ms) / 86400000);
}
function needsFollowUp(lead, elapsed, todayMs) {
  if (lead.status === "converted" || lead.status === "closed") return false;
  if (!lead.first_notice_date) return false;
  const current = !lead.second_notice_date
    ? lead.first_notice_date
    : !lead.third_notice_date
      ? lead.second_notice_date
      : null;
  if (!current) return false;
  const age = ageDays(current, todayMs);
  return age !== null && age >= elapsed;
}

export function summarizeLeadGenerator(
  { leads = [], sales = [], followUpDays = 60 },
  asOf = new Date(),
) {
  const ageThreshold = Math.max(1, Math.min(365, Number(followUpDays) || 60));
  const today = validDay(asOf.toISOString().slice(0, 10));
  const audiences = Object.entries(LEAD_AUDIENCES).map(([key, label]) => {
    const rows = leads.filter((lead) => (lead.audience || "homeowner") === key);
    return {
      key, label,
      total: rows.length,
      converted: rows.filter((lead) => lead.status === "converted").length,
      followUpDue: rows.filter((lead) => needsFollowUp(lead, ageThreshold, today)).length,
      notSent: rows.filter((lead) =>
        lead.status !== "converted" && lead.status !== "closed" && !lead.first_notice_date
      ).length,
    };
  });
  const allValues = sales.map((sale) => Number(sale.job_value || 0)).filter((value) => Number.isFinite(value));
  return {
    source: "PermitCloser Lead Generator",
    asOf: asOf.toISOString(),
    business: "permit_closer",
    metrics: {
      leads: leads.length,
      convertedLeads: leads.filter((lead) => lead.status === "converted").length,
      followUpsDue: audiences.reduce((sum, row) => sum + row.followUpDue, 0),
      sales: sales.length,
      inProgressSales: sales.filter((sale) => sale.status === "in_progress").length,
      completedSales: sales.filter((sale) => sale.status === "completed").length,
      pipelineJobValue: Math.round(allValues.reduce((sum, value) => sum + value, 0) * 100) / 100,
    },
    audiences,
    tools: {
      leadGenerator: "https://lead-generator-seven-kappa.vercel.app/",
      sales: "https://lead-generator-seven-kappa.vercel.app/sales",
      finances: "https://lead-generator-seven-kappa.vercel.app/finances",
    },
    limitations: [
      "Sales conversions are not proof a corresponding Majestic Hub job exists.",
      "Actual Hub job links must be verified against the Majestic portal.",
      "Pipeline job value is not booked revenue or money received.",
      "Audience data is kept separate; the Majestic and PermitAIO contractor campaigns are not PermitCloser permit jobs.",
      "The full Lead Generator must only be opened after real authentication; iframe or embed parameters alone are not authorization.",
    ],
  };
}
