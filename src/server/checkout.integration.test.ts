import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";

process.env.PG_DATABASE = "barberad_test";

test("a shop cannot read another, and a checkout cannot be edited", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { adminUrl, appUrl } = await import("./database-url.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });

  const { addBarberAccount, createOwnerAccount } = await import("./auth.ts");
  const { closeDrawer, completeCheckout, createService, listServices, listToday, visibleCheckoutIds } =
    await import("./shop.ts");

  const shopA = await createOwnerAccount({
    email: "dueno-a@barberad.local",
    password: "clave-segura",
    ownerName: "Ana",
    shopName: "Imperial",
  });
  const shopB = await createOwnerAccount({
    email: "dueno-b@barberad.local",
    password: "clave-segura",
    ownerName: "Bruno",
    shopName: "Norte",
  });
  await addBarberAccount(shopA, {
    email: "barbero-a@barberad.local",
    password: "clave-segura",
    displayName: "Camilo",
    commissionPercent: 50,
  });

  const { contextForUser } = await import("./auth.ts");
  const { appDb } = await import("./db.ts");
  const users = await appDb()<{ id: string }[]>`
    select user_id as id from app_find_user_by_email('barbero-a@barberad.local')
  `;
  const barber = await contextForUser(users[0].id);
  assert.ok(barber);

  await createService(shopA, { name: "Corte clásico", durationMin: 40, listPrice: 20000 });
  const services = await listServices(shopA, true);
  const serviceId = services[0].id;

  await assert.rejects(
    () =>
      completeCheckout(barber, {
        serviceId,
        amount: 15000,
        reason: "   ",
        tip: 0,
        paymentMethod: "cash",
        clientKey: crypto.randomUUID(),
      }),
    /precio de lista/,
  );

  const clientKey = crypto.randomUUID();
  const receipt = await completeCheckout(barber, {
    serviceId,
    amount: 15000,
    reason: "cliente frecuente",
    tip: 2000,
    paymentMethod: "cash",
    clientKey,
  });
  assert.equal(receipt.charged, 15000);
  assert.equal(receipt.commissionAmount, 7500);
  assert.equal(receipt.tip, 2000);

  const again = await completeCheckout(barber, {
    serviceId,
    amount: 15000,
    reason: "cliente frecuente",
    tip: 2000,
    paymentMethod: "cash",
    clientKey,
  });
  assert.equal(again.id, receipt.id);

  const todayA = await listToday(barber);
  assert.equal(todayA.checkouts.length, 1);
  assert.equal(todayA.expectedCash, 17000);

  const seenByB = await visibleCheckoutIds(shopB);
  assert.equal(seenByB.some((row) => row.id === receipt.id), false);
  await assert.rejects(
    () =>
      completeCheckout(shopB, {
        serviceId,
        amount: 20000,
        reason: "",
        tip: 0,
        paymentMethod: "card",
        clientKey: crypto.randomUUID(),
      }),
    /no está disponible/,
  );

  const owner = postgres(adminUrl("barberad_test"), { max: 1 });
  const app = postgres(appUrl("barberad_test"), { max: 1 });
  try {
    await assert.rejects(() => owner`update checkouts set charged = charged - 1`, /checkout_immutable/);
    await assert.rejects(() => owner`delete from checkouts`, /checkout_immutable/);
    await assert.rejects(() => app`update checkouts set charged = charged - 1`);
  } finally {
    await owner.end();
    await app.end();
  }

  const still = await listToday(shopA);
  assert.equal(still.checkouts[0].charged, 15000);
  assert.equal(still.checkouts[0].commissionAmount, 7500);

  await closeDrawer(shopA, 17000);
  await assert.rejects(
    () =>
      completeCheckout(barber, {
        serviceId,
        amount: 20000,
        reason: "",
        tip: 0,
        paymentMethod: "transfer",
        clientKey: crypto.randomUUID(),
      }),
    /caja de hoy/,
  );
});

test("password links are single use and each shop only edits itself", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });

  const auth = await import("./auth.ts");
  const shop = await import("./shop.ts");
  const { withShop } = await import("./db.ts");
  const { appDb } = await import("./db.ts");
  const { tokenHash } = await import("./token.ts");

  const shopA = await auth.createOwnerAccount({
    email: "dueno-a@barberad.local",
    password: "clave-segura",
    ownerName: "Ana",
    shopName: "Imperial",
  });
  const shopB = await auth.createOwnerAccount({
    email: "dueno-b@barberad.local",
    password: "clave-segura",
    ownerName: "Bruno",
    shopName: "Norte",
  });
  await auth.addBarberAccount(shopA, {
    email: "barbero-a@barberad.local",
    password: "clave-segura",
    displayName: "Camilo",
    commissionPercent: 50,
  });
  const found = await appDb()<{ id: string }[]>`
    select user_id as id from app_find_user_by_email('barbero-a@barberad.local')
  `;
  const barber = await auth.contextForUser(found[0].id);
  assert.ok(barber);

  assert.equal(await auth.createPasswordReset("nadie@barberad.local", tokenHash("x".repeat(43))), false);
  const token = "a".repeat(43);
  assert.equal(await auth.createPasswordReset("DUENO-A@barberad.local", tokenHash(token)), true);
  assert.equal(await auth.resetTokenIsValid(tokenHash(token)), true);
  await auth.createSession(shopA.userId, "sesion-vieja");
  await auth.consumePasswordReset(tokenHash(token), "clave-nueva-1");
  assert.equal(await auth.readSessionUser("sesion-vieja"), null);
  await assert.rejects(() => auth.consumePasswordReset(tokenHash(token), "clave-nueva-2"), /venció o ya se usó/);
  await assert.rejects(() => auth.authenticate("dueno-a@barberad.local", "clave-segura"), /incorrectos/);
  await auth.authenticate("dueno-a@barberad.local", "clave-nueva-1");

  await assert.rejects(
    () => auth.changePassword(shopA, { current: "mal", next: "otra-clave-9", keepSessionHash: "x" }),
    /actual no coincide/,
  );
  await auth.createSession(shopA.userId, "esta-sesion");
  await auth.createSession(shopA.userId, "otra-sesion");
  await auth.changePassword(shopA, { current: "clave-nueva-1", next: "otra-clave-9", keepSessionHash: "esta-sesion" });
  assert.equal(await auth.readSessionUser("esta-sesion"), shopA.userId);
  assert.equal(await auth.readSessionUser("otra-sesion"), null);

  await assert.rejects(() => auth.resetMemberPassword(shopB, barber.memberId, "clave-ajena-1"), /permiso/);
  await auth.resetMemberPassword(shopA, barber.memberId, "clave-barbero-2");
  await auth.authenticate("barbero-a@barberad.local", "clave-barbero-2");
  assert.equal((await auth.memberEmails(shopB)).has(barber.memberId), false);
  assert.equal((await auth.memberEmails(shopA)).get(barber.memberId), "barbero-a@barberad.local");

  await assert.rejects(() => shop.updateCommission(shopB, barber.memberId, 10), /no existe/);
  await shop.updateCommission(shopA, barber.memberId, 40);
  assert.equal((await auth.contextForUser(barber.userId))?.commissionPercent, 40);

  await shop.updateShopProfile(shopA, { name: "Imperial Centro", phone: "300 123 4567", address: "Calle 10 # 5-20" });
  await withShop(shopB, (tx) => tx`update shops set name = 'Robada' where id = ${shopA.shopId}::uuid`);
  assert.equal((await shop.shopProfile(shopA)).name, "Imperial Centro");
  assert.equal((await shop.shopProfile(shopB)).name, "Norte");
  await assert.rejects(() => shop.updateShopProfile(barber, { name: "X", phone: "", address: "" }), /Solo el dueño/);

  const guide = await shop.guideStatus(shopA);
  assert.ok(guide);
  assert.equal(guide.done, 2);
  assert.deepEqual(
    guide.steps.filter((step) => step.done).map((step) => step.id),
    ["team", "profile"],
  );
  assert.equal(await shop.guideStatus(barber), null);
});
