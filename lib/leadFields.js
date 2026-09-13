export const LEAD_FIELDS = [
  'audience', 'name', 'address', 'county', 'permit_number', 'permit_type',
  'date_issued', 'date_expired', 'contact', 'email', 'notes',
  'first_notice_date', 'second_notice_date', 'third_notice_date', 'status',
];

const DATE_FIELDS = new Set(['first_notice_date', 'second_notice_date', 'third_notice_date']);

export function cleanLead(row) {
  const out = {};
  for (const key of LEAD_FIELDS) {
    if (!row || row[key] === undefined) continue;
    if (DATE_FIELDS.has(key) && (row[key] === '' || row[key] == null)) out[key] = null;
    else out[key] = row[key];
  }
  return out;
}
