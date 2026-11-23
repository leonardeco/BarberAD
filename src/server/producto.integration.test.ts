import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

process.env.PG_DATABASE = "barberad_test";

function signEvent(body: { data: unknown; timestamp: number; signature: { properties: string[] } }, secret: string) {
  const pick = (path: string) => path.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], body.data);
  const raw = body.signature.properties.map((p) => String(pick(p))).join("") + body.timestamp + secret;
  return createHash("sha256").update(raw).digest("hex");
}

test("planes: límites del Gratis y pago del Pro con Wompi", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { adminUrl } = await import("./database-url.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });
  const auth = await import("./auth.ts");
  const shop = await import("./shop.ts");
  const agenda = await import("./agenda.ts");
  const billing = await import("./billing.ts");

  const owner = await auth.createOwnerAccount({
    email: "d@plan.local", password: "clave-segura", ownerName: "Ana", shopName: "Navaja", phone: "300 123 4567", takesAppointments: true,
  });
  assert.equal((await shop.shopProfile(owner)).phone, "573001234567");
  await assert.rejects(
    () => auth.createOwnerAccount({ email: "x@plan.local", password: "clave-segura", ownerName: "X", shopName: "X", phone: "12" }),
    /WhatsApp válido/,
  );

  const addBarber = (n: number) =>
    auth.addBarberAccount(owner, { email: `b${n}@plan.local`, password: "clave-segura", displayName: `Barbero ${n}`, commissionPercent: 50 });
  await addBarber(1);
  await addBarber(2);
  await assert.rejects(() => addBarber(3), /plan Gratis permite hasta 2 barberos/);
  let status = await billing.planStatus(owner);
  assert.equal(status.pro, false);
  assert.equal(status.barbers, 2);

  // Sin llaves de Wompi no se puede pagar.
  await assert.rejects(() => billing.startProCheckout(owner, 1), /todavía no están activados/);

  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      WOMPI_PUBLIC_KEY: "pub_test_abc",
      WOMPI_INTEGRITY_SECRET: "test_integrity_secret",
      WOMPI_EVENTS_SECRET: "test_events_secret",
      PLAN_PRO_PRICE: "29900",
      APP_URL: "https://barberad.co",
    });
    await assert.rejects(() => billing.startProCheckout(owner, 3), /1, 6 o 12/);
    const url = new URL(await billing.startProCheckout(owner, 1));
    assert.equal(url.origin + url.pathname, "https://checkout.wompi.co/p/");
    const reference = url.searchParams.get("reference")!;
    assert.equal(url.searchParams.get("amount-in-cents"), "2990000");
    assert.equal(url.searchParams.get("currency"), "COP");
    assert.equal(
      url.searchParams.get("signature:integrity"),
      createHash("sha256").update(`${reference}2990000COPtest_integrity_secret`).digest("hex"),
    );
    assert.equal(url.searchParams.get("redirect-url"), `https://barberad.co/plan?ref=${reference}`);

    const event = (status: string, amount = 2990000) => {
      const body = {
        event: "transaction.updated",
        data: { transaction: { id: "1234-1610641025-49201", amount_in_cents: amount, reference, status, currency: "COP" } },
        signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum: "" },
        timestamp: 1700000000,
        sent_at: "2026-11-20T00:00:00.000Z",
      };
      body.signature.checksum = signEvent(body, "test_events_secret");
      return body;
    };

    const forged = event("APPROVED");
    forged.signature.checksum = "0".repeat(64);
    assert.deepEqual(await billing.handleWompiEvent(forged), { ok: false, reason: "firma" });
    const tampered = event("APPROVED");
    tampered.data.transaction.amount_in_cents = 100;
    assert.equal((await billing.handleWompiEvent(tampered)).ok, false, "cambiar el monto rompe la firma");

    assert.deepEqual(await billing.handleWompiEvent(event("PENDING")), { ok: true, result: "pendiente" });
    assert.deepEqual(await billing.handleWompiEvent(event("APPROVED")), { ok: true, result: "approved" });
    assert.deepEqual(await billing.handleWompiEvent(event("APPROVED")), { ok: true, result: "already" }, "el aviso repetido no suma otro mes");
    status = await billing.planStatus(owner);
    assert.equal(status.pro, true);
    assert.equal(status.payments[0].status, "approved");
    await addBarber(3);

    // Un pago aprobado por otro monto no activa nada.
    const url2 = new URL(await billing.startProCheckout(owner, 6));
    const ref2 = url2.searchParams.get("reference")!;
    const mismatch = event("APPROVED", 100);
    mismatch.data.transaction.reference = ref2;
    mismatch.signature.checksum = signEvent(mismatch, "test_events_secret");
    assert.deepEqual(await billing.handleWompiEvent(mismatch), { ok: true, result: "amount_mismatch" });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }

  // Límite de reservas en línea del plan Gratis (otra barbería).
  const free = await auth.createOwnerAccount({ email: "f@plan.local", password: "clave-segura", ownerName: "Fede", shopName: "Gratis", takesAppointments: true });
  await shop.createService(free, { name: "Corte", durationMin: 30, listPrice: 20000 });
  const [service] = await shop.listServices(free, true);
  const postgres = (await import("postgres")).default;
  const admin = postgres(adminUrl("barberad_test"), { max: 1 });
  try {
    await admin`
      with c as (insert into clients (shop_id, name, phone) values (${free.shopId}::uuid, 'Lleno', '3000000000') returning id)
      insert into appointments (shop_id, member_id, service_id, client_id, service_name, list_price, starts_at, ends_at, status, source)
      select ${free.shopId}::uuid, ${free.memberId}::uuid, ${service.id}::uuid, c.id, 'Corte', 20000,
             now() + make_interval(days => 400 + g), now() + make_interval(days => 400 + g, mins => 30), 'cancelled', 'public'
      from c, generate_series(1, 50) g
    `;
  } finally {
    await admin.end();
  }
  const slug = (await agenda.shopSlug(free))!;
  const pub = (await agenda.publicShop(slug))!;
  let day = agenda.addDays(pub.today, 1);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() === 0) day = agenda.addDays(day, 1);
  const [slot] = await agenda.freeSlots({ shopId: pub.id, timezone: pub.timezone, serviceId: service.id, memberId: null, day });
  await assert.rejects(
    () => agenda.bookPublic({ slug, serviceId: service.id, memberId: null, startsAt: slot.startsAt, name: "Luis", phone: "3001112233" }),
    /límite de reservas en línea/,
  );
  // Agendar a mano no tiene límite.
  await agenda.createStaffAppointment(free, { memberId: free.memberId, serviceId: service.id, day, time: "10:00", clientName: "Luis", phone: "3001112233" });
});

test("Google, página pública y perfil", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });
  const auth = await import("./auth.ts");
  const shop = await import("./shop.ts");
  const agenda = await import("./agenda.ts");
  const google = await import("./google.ts");

  const viaGoogle = await auth.createOwnerAccount({
    email: "g@plan.local", password: "aleatoria-larga-123", ownerName: "Gabi", shopName: "Gabi Barber", googleSub: "google-123",
  });
  assert.equal(await auth.findUserByGoogle("google-123", "otro@correo.co"), viaGoogle.userId);
  assert.equal(await auth.findUserByGoogle("google-999", "nadie@plan.local"), null);
  // Una cuenta con contraseña se vincula a Google si Google confirma el mismo correo.
  const classic = await auth.createOwnerAccount({ email: "c@plan.local", password: "clave-segura", ownerName: "Caro", shopName: "Caro" });
  assert.equal(await auth.findUserByGoogle("google-456", "C@plan.local"), classic.userId);
  assert.equal(await auth.findUserByGoogle("google-456", "x@x.co"), classic.userId);

  const signed = google.signPending({ sub: "s", email: "e@x.co", name: "Eva" });
  assert.deepEqual(google.readPending(signed), { sub: "s", email: "e@x.co", name: "Eva" });
  const [payload, mac] = signed.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "otro", email: "e@x.co", name: "Eva", exp: Date.now() + 60000 })).toString("base64url");
  assert.equal(google.readPending(`${forged}.${mac}`), null);
  assert.equal(google.readPending(`${payload}.x`), null);
  assert.equal(google.readPending(undefined), null);

  await shop.updateShopProfile(viaGoogle, {
    name: "Gabi Barber", phone: "3001234567", address: "Calle 10 # 5-20, Medellín",
    about: "Fades y barbas desde 2015.", instagram: "https://instagram.com/gabi.barber/",
  });
  await assert.rejects(
    () => shop.updateShopProfile(viaGoogle, { name: "Gabi", phone: "", address: "", instagram: "mal usuario!" }),
    /usuario de Instagram/,
  );
  // Sin about ni instagram, no se borran.
  await shop.updateShopProfile(viaGoogle, { name: "Gabi Barber", phone: "3001234567", address: "Calle 10 # 5-20, Medellín" });
  const pub = (await agenda.publicShop((await agenda.shopSlug(viaGoogle))!))!;
  assert.equal(pub.instagram, "gabi.barber");
  assert.equal(pub.about, "Fades y barbas desde 2015.");
  assert.deepEqual(pub.hours, [], "Gabi no marcó que atiende");
  await auth.addBarberAccount(viaGoogle, { email: "b@g.local", password: "clave-segura", displayName: "Beto", commissionPercent: 40 });
  const withTeam = (await agenda.publicShop((await agenda.shopSlug(viaGoogle))!))!;
  assert.deepEqual(withTeam.hours.map((h) => h.weekday), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(withTeam.hours[0], { weekday: 1, start: 540, end: 1140 });
});
