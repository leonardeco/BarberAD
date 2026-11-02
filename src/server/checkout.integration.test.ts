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
