import assert from "node:assert/strict";
import test from "node:test";

process.env.PG_DATABASE = "barberad_test";

test("límite de intentos al entrar, pedir enlaces y reservar", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });
  const auth = await import("./auth.ts");
  const throttle = await import("./throttle.ts");

  await auth.createOwnerAccount({ email: "ana@p.local", password: "clave-segura", ownerName: "Ana", shopName: "Navaja" });
  for (let i = 0; i < 4; i += 1) {
    await assert.rejects(() => auth.authenticate("ana@p.local", "mala-clave", "1.1.1.1"), /incorrectos/);
  }
  // Entrar bien borra los fallos.
  await auth.authenticate("ana@p.local", "clave-segura", "1.1.1.1");
  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(() => auth.authenticate("ANA@p.local", "mala-clave", `2.2.2.${i}`), /incorrectos/);
  }
  // Cinco fallos de ese correo, aunque vengan de IPs distintas: ni con la clave buena entra.
  await assert.rejects(() => auth.authenticate("ana@p.local", "clave-segura", "3.3.3.3"), /Demasiados intentos/);
  // Otro correo desde otra IP sigue normal.
  await assert.rejects(() => auth.authenticate("otro@p.local", "x-x-x-x-x", "4.4.4.4"), /incorrectos/);

  // Muchos correos distintos desde la misma IP también se frenan.
  for (let i = 0; i < 30; i += 1) await throttle.recordAttempt("login", `u${i}@p.local`, "9.9.9.9");
  await assert.rejects(() => auth.authenticate("nuevo@p.local", "x-x-x-x-x", "9.9.9.9"), /Demasiados intentos/);

  for (let i = 0; i < 3; i += 1) await throttle.recordAttempt("reset", "ana@p.local", "5.5.5.5");
  assert.equal(await throttle.isBlocked("reset", "ana@p.local", "6.6.6.6"), true);
  assert.equal(await throttle.isBlocked("reset", "otra@p.local", "6.6.6.6"), false);
  for (let i = 0; i < 15; i += 1) await throttle.recordAttempt("book", `30000000${i}`, "7.7.7.7");
  assert.equal(await throttle.isBlocked("book", "3001234567", "7.7.7.7"), true);
});

test("anular un cobro: deja de contar, queda registrado y tiene límites", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { adminUrl } = await import("./database-url.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });
  const auth = await import("./auth.ts");
  const shop = await import("./shop.ts");
  const agenda = await import("./agenda.ts");
  const reports = await import("./reports.ts");
  const { appDb } = await import("./db.ts");

  const owner = await auth.createOwnerAccount({ email: "d@v.local", password: "clave-segura", ownerName: "Ana", shopName: "Navaja", takesAppointments: true });
  const other = await auth.createOwnerAccount({ email: "o@v.local", password: "clave-segura", ownerName: "Otro", shopName: "Otra" });
  await auth.addBarberAccount(owner, { email: "c@v.local", password: "clave-segura", displayName: "Camilo", commissionPercent: 50 });
  const [found] = await appDb()<{ id: string }[]>`select user_id as id from app_find_user_by_email('c@v.local')`;
  const barber = (await auth.contextForUser(found.id))!;
  await shop.createService(owner, { name: "Corte", durationMin: 30, listPrice: 20000 });
  const [service] = await shop.listServices(owner, true);
  const pay = (ctx: typeof owner, method = "cash", appointmentId?: string) =>
    shop.completeCheckout(ctx, { serviceId: service.id, amount: 20000, reason: "", tip: 1000, paymentMethod: method, clientKey: crypto.randomUUID(), appointmentId });

  const wrong = await pay(barber, "card");
  const right = await pay(barber, "cash");
  await assert.rejects(() => shop.voidCheckout(barber, wrong.id, "error"), /Solo el dueño/);
  await assert.rejects(() => shop.voidCheckout(owner, wrong.id, "  "), /por qué/);
  await assert.rejects(() => shop.voidCheckout(other, wrong.id, "ajeno"), /no existe/);
  await shop.voidCheckout(owner, wrong.id, "Se marcó tarjeta y fue efectivo");
  await assert.rejects(() => shop.voidCheckout(owner, wrong.id, "otra vez"), /ya estaba anulado/);

  const today = await shop.listToday(owner);
  assert.equal(today.checkouts.length, 1);
  assert.equal(today.charged, 20000);
  assert.equal(today.byMethod.card, 0);
  assert.deepEqual(today.voided.map((v) => v.reason), ["Se marcó tarjeta y fue efectivo"]);
  const day = await agenda.shopToday(owner);
  const report = await reports.shopReport(owner, day, day);
  assert.equal(report.totals.cuts, 1);
  assert.equal(report.totals.teamCommission, 10000);
  const pending = (await reports.pendingPayouts(owner)).find((p) => p.name === "Camilo")!;
  assert.equal(pending.commission, 10000);
  assert.equal(pending.tips, 1000);

  // Ya liquidado, no se anula.
  await reports.payBarber(owner, barber.memberId);
  await assert.rejects(() => shop.voidCheckout(owner, right.id, "tarde"), /ya se le pagó/);

  // Una cita cobrada y anulada vuelve a quedar por cobrar, y se cobra bien una sola vez.
  await agenda.createStaffAppointment(owner, { memberId: barber.memberId, serviceId: service.id, day: agenda.addDays(day, 1), time: "10:00", clientName: "Luis", phone: "3001110001" });
  const [appointment] = (await agenda.dayAgenda(owner, agenda.addDays(day, 1))).appointments;
  const first = await pay(barber, "card", appointment.id);
  await shop.voidCheckout(owner, first.id, "Era efectivo");
  assert.equal((await agenda.dayAgenda(owner, agenda.addDays(day, 1))).appointments[0].status, "booked");
  await pay(barber, "cash", appointment.id);
  await assert.rejects(() => pay(barber, "cash", appointment.id), /ya se cobró/);
  const agendaAfter = (await agenda.dayAgenda(owner, agenda.addDays(day, 1))).appointments[0];
  assert.equal(agendaAfter.charged, 21000);

  // Con la caja cerrada ya no se anula.
  const last = await pay(owner);
  await shop.closeDrawer(owner, 0);
  await assert.rejects(() => shop.voidCheckout(owner, last.id, "tarde"), /ya se cerró/);

  // Las anulaciones no se editan ni se borran.
  const postgres = (await import("postgres")).default;
  const admin = postgres(adminUrl("barberad_test"), { max: 1 });
  try {
    await assert.rejects(() => admin`delete from checkout_voids`);
  } finally {
    await admin.end();
  }
});

test("producción: base remota y secretos", async () => {
  const db = await import("./database-url.ts");
  const token = await import("./token.ts");
  const saved = { ...process.env };
  try {
    process.env.DATABASE_ADMIN_URL = "postgresql://neondb_owner:secreto@ep-cool-123-pooler.us-east-2.aws.neon.tech/barberad?sslmode=require";
    process.env.PG_APP_PASSWORD = "clave app/con:raros";
    const app = new URL(db.appUrl());
    assert.equal(app.username, "barberad_app");
    assert.equal(decodeURIComponent(app.password), "clave app/con:raros");
    assert.equal(app.hostname, "ep-cool-123-pooler.us-east-2.aws.neon.tech");
    assert.equal(app.searchParams.get("sslmode"), "require");
    assert.equal(db.adminUrl(), process.env.DATABASE_ADMIN_URL);
    assert.equal(db.connectionOptions(db.appUrl()).prepare, false, "el pooler no admite sentencias preparadas");
    assert.equal(db.connectionOptions(db.appUrl()).max, 3);
    process.env.DATABASE_URL = "postgres://barberad_app:x@otro.host/db";
    assert.equal(db.appUrl(), "postgres://barberad_app:x@otro.host/db");

    const { migrate } = await import("./migrate.ts");
    await assert.rejects(() => migrate("barberad_test", { fresh: true }), /No se borra una base remota/);

    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.SESSION_SECRET = "cambia-esta-clave-local";
    assert.throws(() => token.tokenHash("x"), /SESSION_SECRET no es seguro/);
    process.env.SESSION_SECRET = "corta";
    assert.throws(() => token.tokenHash("x"), /al menos 32/);
    process.env.SESSION_SECRET = "x".repeat(48);
    assert.match(token.tokenHash("x"), /^[0-9a-f]{64}$/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
