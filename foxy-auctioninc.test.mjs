function lbsOzToWeight(lbs, oz) {
  const l = parseFloat(lbs), o = parseFloat(oz);
  const total = (isNaN(l) ? 0 : l) + (isNaN(o) ? 0 : o) / 16;
  return Math.round(total * 100) / 100;
}
function sanitizeOptionName(raw) {
  return String(raw || "").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_") || "option";
}
import assert from "node:assert";
assert.strictEqual(lbsOzToWeight("3", "6"), 3.38);
assert.strictEqual(lbsOzToWeight("0", "6"), 0.38);
assert.strictEqual(lbsOzToWeight("1", ""), 1);
assert.strictEqual(lbsOzToWeight("", ""), 0);
assert.strictEqual(sanitizeOptionName("Make, Model & Year."), "Make_Model_Year");
assert.strictEqual(sanitizeOptionName(""), "option");
console.log("OK: all transform assertions passed");
