import test from "node:test";
import assert from "node:assert/strict";
import { flagDuplicateImportRows, leadImportKey } from "../lib/leadDedup.js";

test("duplicate import rows are suppressed inside the same upload batch", () => {
  const rows = flagDuplicateImportRows([
    { audience:"homeowner", name:"Sample Owner", address:"123 TEST ST", permit_number:"26-1234" },
    { audience:"homeowner", name:"Sample Owner", address:"123 Test Street", permit_number:"26 1234" },
    { audience:"homeowner", name:"Other Owner", address:"456 Example Ave", permit_number:"26-5678" }
  ]);
  assert.deepEqual(rows.map(r=>r._dup), [false,true,false]);
});
test("existing records are matched within audience", () => {
  const existing=[{audience:"realtor_broker",name:"A Broker",address:"123 Market St",permit_number:""}];
  assert.deepEqual(flagDuplicateImportRows([
    {name:"A Broker",address:"123 Market St",permit_number:""},
    {name:"Different Broker",address:"123 Market St",permit_number:""}
  ],existing,"realtor_broker").map(r=>r._dup),[true,false]);
});
test("other audiences are not treated as duplicates", () => {
  assert.notEqual(leadImportKey({audience:"homeowner",permit_number:"26-001"}),
    leadImportKey({audience:"property_manager",permit_number:"26-001"}));
});
