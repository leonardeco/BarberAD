import assert from "node:assert/strict";
import test from "node:test";
import { proOptions, proPrice, proTotal } from "./plans.ts";

test("precios del plan Pro: $20.000 al mes, con descuento a 6 y 12 meses", () => {
  const saved = process.env.PLAN_PRO_PRICE;
  delete process.env.PLAN_PRO_PRICE;
  try {
    assert.equal(proPrice(), 20000);
    assert.equal(proTotal(1), 20000);
    assert.equal(proTotal(6), 108000, "6 meses con 10% de descuento");
    assert.equal(proTotal(12), 192000, "12 meses con 20% de descuento");
    assert.equal(proTotal(3), null);
    assert.deepEqual(proOptions.map((o) => o.months), [1, 6, 12]);
    process.env.PLAN_PRO_PRICE = "abc";
    assert.equal(proPrice(), 20000);
    process.env.PLAN_PRO_PRICE = "25000";
    assert.equal(proTotal(6), 135000);
  } finally {
    if (saved === undefined) delete process.env.PLAN_PRO_PRICE;
    else process.env.PLAN_PRO_PRICE = saved;
  }
});
