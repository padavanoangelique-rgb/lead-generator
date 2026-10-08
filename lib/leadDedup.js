/** Normalization for a single audience's lead list; used for imports and tests. */
function clean(value) {
  return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " ");
}
export function leadImportKey(lead, defaultAudience = "homeowner") {
  const audience = clean(lead?.audience || defaultAudience);
  const permit = clean(lead?.permit_number).replace(/[^a-z0-9]/g, "");
  if (permit) return audience + "|permit:" + permit;
  return audience + "|contact:" + clean(lead?.name) + "|address:" + clean(lead?.address);
}
export function flagDuplicateImportRows(incoming, existing = [], audience = "homeowner") {
  const known = new Set(existing.map((item) => leadImportKey(item, audience)));
  return incoming.map((item) => {
    const key = leadImportKey(item, audience);
    const duplicate = known.has(key);
    known.add(key);
    return { ...item, audience: item.audience || audience, _dup: duplicate };
  });
}
