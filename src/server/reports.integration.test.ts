import assert from "node:assert/strict";
import test from "node:test";

process.env.PG_DATABASE = "barberad_test";

test("ganancias: cuánto le queda a la barbería y cuánto se le debe a cada barbero", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { adminUrl } = await import("./database-url.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });

  const auth = await import("./auth.ts");
  const shop = await import("./shop.ts");
  const reports = await import("./reports.ts");
  const { shopToday } = await import("./agenda.ts");
  const { appDb } = await import("./db.ts");

  const owner = await auth.createOwnerAccount({ email: "d@g.local", password: "clave-segura", ownerName: "Ana", shopName: "Navaja", takesAppointments: true });
  const other = await auth.createOwnerAccount({ email: "o@g.local", password: "clave-segura", ownerName: "Otro", shopName: "Otra" });
  const ctxOf = async (email: string, name: string, pct: number) => {
    await auth.addBarberAccount(owner, { email, password: "clave-segura", displayName: name, commissionPercent: pct });
    const [row] = await appDb()<{ id: string }[]>`select user_id as id from app_find_user_by_email(${email})`;
    return (await auth.contextForUser(row.id))!;
  };
  const camilo = await ctxOf("c@g.local", "Camilo", 50);
  const diego = await ctxOf("x@g.local", "Diego", 40);

  await shop.createService(owner, { name: "Corte", durationMin: 30, listPrice: 20000 });
  await shop.createService(owner, { name: "Barba", durationMin: 20, listPrice: 10000, commissionPercent: 30 });
  await assert.rejects(() => shop.createService(owner, { name: "X", durationMin: 20, listPrice: 1, commissionPercent: 101 }), /entre 0 y 100/);
  const services = await shop.listServices(owner, true);
  const corte = services.find((s) => s.name === "Corte")!;
  const barba = services.find((s) => s.name === "Barba")!;
  assert.equal(barba.commission_percent, 30);

  const pay = (ctx: typeof owner, serviceId: string, amount: number, extra: { tip?: number; method?: string; memberId?: string } = {}) =>
    shop.completeCheckout(ctx, {
      serviceId, amount, reason: "", tip: extra.tip ?? 0, paymentMethod: extra.method ?? "cash",
      clientKey: crypto.randomUUID(), memberId: extra.memberId,
    });

  assert.equal((await pay(camilo, corte.id, 20000, { tip: 2000 })).commissionAmount, 10000);
  assert.equal((await pay(camilo, barba.id, 10000)).commissionAmount, 3000, "la comisión del servicio manda sobre la del barbero");
  await pay(owner, corte.id, 20000);
  assert.equal((await pay(owner, corte.id, 20000, { method: "card", memberId: diego.memberId })).commissionAmount, 8000);
  await assert.rejects(() => pay(camilo, corte.id, 20000, { memberId: diego.memberId }), /Solo el dueño/);
  await assert.rejects(() => pay(owner, corte.id, 20000, { memberId: other.memberId }), /no está disponible/);

  const today = await shopToday(owner);
  const report = await reports.shopReport(owner, today, today);
  assert.equal(report.totals.cuts, 4);
  assert.equal(report.totals.charged, 70000);
  assert.equal(report.totals.teamCommission, 21000);
  assert.equal(report.totals.shopProfit, 49000);
  assert.equal(report.totals.tips, 2000);
  assert.deepEqual(report.byMethod, { cash: 52000, transfer: 0, card: 20000 });
  const line = (name: string) => report.byBarber.find((b) => b.name === name)!;
  assert.equal(line("Camilo").commission, 13000);
  assert.equal(line("Camilo").shopShare, 17000);
  assert.equal(line("Ana").commission, 0);
  assert.equal(line("Ana").shopShare, 20000);
  assert.equal(line("Diego").charged, 20000);
  assert.deepEqual(report.byService[0], { name: "Corte", cuts: 3, charged: 60000 });
  assert.equal(report.previous.cuts, 0);
  assert.equal((await reports.shopReport(other, today, today)).totals.cuts, 0);
  await assert.rejects(() => reports.shopReport(camilo, today, today), /Solo el dueño/);

  // Liquidación: comisión más propinas, una sola vez.
  const pending = await reports.pendingPayouts(owner);
  const camiloPending = pending.find((p) => p.name === "Camilo")!;
  assert.equal(camiloPending.commission, 13000);
  assert.equal(camiloPending.tips, 2000);
  const paid = await reports.payBarber(owner, camilo.memberId);
  assert.equal(paid.total, 15000);
  await assert.rejects(() => reports.payBarber(owner, camilo.memberId), /nada pendiente/);
  await assert.rejects(() => reports.payBarber(camilo, camilo.memberId), /Solo el dueño/);
  await pay(camilo, corte.id, 20000);
  assert.equal((await reports.pendingPayouts(owner)).find((p) => p.name === "Camilo")!.commission, 10000);
  assert.equal((await reports.payoutHistory(owner)).length, 1);
  assert.equal((await reports.payoutHistory(other)).length, 0);

  const postgres = (await import("postgres")).default;
  const admin = postgres(adminUrl("barberad_test"), { max: 1 });
  try {
    await assert.rejects(() => admin`update payouts set commission = 0`);
    await assert.rejects(() => admin`delete from payout_items`);
  } finally {
    await admin.end();
  }
});

test("períodos del reporte", async () => {
  const { resolvePeriod } = await import("./periods.ts");
  const today = "2026-11-20"; // viernes
  assert.deepEqual(resolvePeriod(today, { p: "semana" }), { key: "semana", from: "2026-11-16", to: today });
  assert.deepEqual(resolvePeriod(today, { p: "mes" }), { key: "mes", from: "2026-11-01", to: today });
  assert.deepEqual(resolvePeriod(today, { p: "mes-pasado" }), { key: "mes-pasado", from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(resolvePeriod(today, { p: "ayer" }), { key: "ayer", from: "2026-11-19", to: "2026-11-19" });
  assert.deepEqual(resolvePeriod(today, { p: "rango", desde: "2026-11-10", hasta: "2026-11-05" }), { key: "hoy", from: today, to: today });
  assert.deepEqual(resolvePeriod("2026-03-01", { p: "mes-pasado" }), { key: "mes-pasado", from: "2026-02-01", to: "2026-02-28" });
});
