import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PESOS, commissionAmount, deriveMoney, readInt, wholePesos } from "./money.ts";

test("readInt solo acepta dígitos", () => {
  assert.equal(readInt("1500"), 1500);
  assert.equal(readInt(" 42 "), 42);
  assert.ok(Number.isNaN(readInt("")));
  assert.ok(Number.isNaN(readInt(null)));
  assert.ok(Number.isNaN(readInt("10.000")));
  assert.ok(Number.isNaN(readInt("-5")));
  assert.ok(Number.isNaN(readInt("12abc")));
  assert.ok(Number.isNaN(readInt("1".repeat(16))));
});

test("wholePesos rechaza lo que no cabe en un cobro", () => {
  assert.equal(wholePesos(0, "El monto"), 0);
  assert.equal(wholePesos(MAX_PESOS, "El monto"), MAX_PESOS);
  assert.throws(() => wholePesos(MAX_PESOS + 1, "El monto"), /no puede pasar de/);
  assert.throws(() => wholePesos(-1, "El monto"), /entero de pesos/);
  assert.throws(() => wholePesos(10.5, "El monto"), /entero de pesos/);
  assert.throws(() => wholePesos(Number.NaN, "El monto"), /entero de pesos/);
});

test("deriveMoney separa adicional y descuento", () => {
  assert.deepEqual(deriveMoney(20000, 25000, ""), {
    listPrice: 20000,
    extras: 5000,
    discount: 0,
    discountReason: "",
    charged: 25000,
  });
  assert.deepEqual(deriveMoney(20000, 15000, " cliente frecuente "), {
    listPrice: 20000,
    extras: 0,
    discount: 5000,
    discountReason: "cliente frecuente",
    charged: 15000,
  });
  assert.throws(() => deriveMoney(20000, 15000, "  "), /motivo/);
  assert.throws(() => deriveMoney(20000, 15000, "x".repeat(121)), /demasiado largo/);
});

test("la comisión redondea hacia abajo y coincide con el cálculo de Postgres", () => {
  assert.equal(commissionAmount(15000, 50), 7500);
  assert.equal(commissionAmount(15001, 50), 7500);
  assert.equal(commissionAmount(MAX_PESOS, 100), MAX_PESOS);
  // Postgres evalúa entero × porcentaje en 32 bits: con el tope no se desborda.
  assert.ok(MAX_PESOS * 100 < 2 ** 31);
});
