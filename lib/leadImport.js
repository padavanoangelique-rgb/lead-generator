// Normalizes rows from a CSV/Excel upload OR pasted text copied straight out of a
// building department portal search grid. Column names on real portals vary a lot
// (e.g. "Situs Address", "Permit #", "Owner Name", "Issued Date") so this matches
// loosely by known aliases instead of requiring our exact column names.

const FIELD_ALIASES = {
  name: ['name', 'owner', 'owner name', 'applicant', 'contact name', 'property owner'],
  address: ['address', 'situs address', 'property address', 'site address', 'project address', 'location'],
  county: ['county', 'jurisdiction'],
  permit_number: ['permit_number', 'permit', 'permit #', 'permit no', 'permit number', 'case number', 'case #', 'record number'],
  permit_type: ['permit_type', 'type', 'permit type', 'work type', 'work class'],
  date_issued: ['issue_date', 'issued', 'issue date', 'date issued', 'issued date'],
  date_expired: ['expire_date', 'expired', 'expiration date', 'expire date', 'date expired', 'exp date', 'expiration'],
  contact: ['contact', 'phone', 'phone number', 'owner phone'],
  email: ['email', 'email address', 'e-mail', 'contact email'],
  notes: ['notes', 'description', 'scope', 'work description', 'status'],
};

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

// rawRows: array of objects (from Papa.parse or XLSX.utils.sheet_to_json), header row assumed.
// Returns up to 100 normalized { name, address, county, permit_number, ... } rows,
// dropping any without at least a name and address.
export function normalizeImportRows(rawRows, defaultCounty = '') {
  return rawRows.slice(0, 100).map((r) => {
    const lookup = buildLookup(r);
    const row = {};
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      row[field] = pick(lookup, aliases);
    }
    if (!row.county && defaultCounty) row.county = defaultCounty;
    if (!row.permit_type) row.permit_type = 'Building';
    return row;
  }).filter((r) => r.name && r.address);
}
