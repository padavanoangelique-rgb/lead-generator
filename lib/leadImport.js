// Normalizes rows from a CSV/Excel upload OR pasted text copied straight out of a
// building department portal search grid. Column names on real portals vary a lot
// (e.g. "Situs Address", "Permit #", "Owner Name", "Issued Date") so this matches
// loosely by known aliases instead of requiring our exact column names.
//
// Contractor lists can also send Qualifier Name + License Number as their own
// columns. Those get folded into the existing leads columns:
//   name          = "Qualifier — Company" when both are present
//   permit_number = license number when no permit # exists (searchable)
//   notes         = "License: XXX | …" so the number is always kept

const FIELD_ALIASES = {
  name: ['name', 'owner', 'owner name', 'applicant', 'contact name', 'property owner', 'company', 'company name', 'brokerage', 'firm', 'office', 'business name'],
  address: ['address', 'situs address', 'property address', 'site address', 'project address', 'location', 'business address', 'mailing address'],
  county: ['county', 'jurisdiction'],
  permit_number: ['permit_number', 'permit', 'permit #', 'permit no', 'permit number', 'case number', 'case #', 'record number'],
  permit_type: ['permit_type', 'type', 'permit type', 'work type', 'work class'],
  date_issued: ['issue_date', 'issued', 'issue date', 'date issued', 'issued date'],
  date_expired: ['expire_date', 'expired', 'expiration date', 'expire date', 'date expired', 'exp date', 'expiration'],
  contact: ['contact', 'phone', 'phone number', 'owner phone'],
  email: ['email', 'email address', 'e-mail', 'contact email'],
  notes: ['notes', 'description', 'scope', 'work description', 'status'],
};

const QUALIFIER_ALIASES = ['qualifier name', 'qualifier', 'qualifying agent', 'qualifier_name', 'qual name'];
const COMPANY_ALIASES = ['company name', 'company', 'business name', 'firm', 'office', 'brokerage', 'contractor company'];
const LICENSE_ALIASES = ['license number', 'license #', 'license no', 'contractor license', 'license', 'lic #', 'lic no', 'license_number', 'cbc', 'ccc', 'cgc'];

function buildLookup(row) {
  const lookup = {};
  for (const key of Object.keys(row)) {
    lookup[key.trim().toLowerCase()] = row[key];
  }
  return lookup;
}

function pick(lookup, aliases) {
  for (const alias of aliases) {
    const v = lookup[alias];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function normalizeImportRows(rawRows, defaultCounty = '') {
  return rawRows.slice(0, 100).map((r) => {
    const lookup = buildLookup(r);
    const row = {};
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      row[field] = pick(lookup, aliases);
    }

    const qualifier = pick(lookup, QUALIFIER_ALIASES);
    const company = pick(lookup, COMPANY_ALIASES);
    const license = pick(lookup, LICENSE_ALIASES);

    if (qualifier && company) {
      row.name = `${qualifier} — ${company}`;
    } else if (qualifier && !row.name) {
      row.name = qualifier;
    } else if (qualifier && row.name && !row.name.toLowerCase().includes(qualifier.toLowerCase())) {
      row.name = `${qualifier} — ${row.name}`;
    } else if (!row.name && company) {
      row.name = company;
    }

    if (license) {
      if (!row.permit_number) row.permit_number = license;
      const tag = `License: ${license}`;
      row.notes = row.notes ? `${tag} | ${row.notes}` : tag;
    }

    if (!row.county && defaultCounty) row.county = defaultCounty;
    if (!row.permit_type) row.permit_type = 'Building';
    return row;
  }).filter((r) => r.name && r.address);
}
