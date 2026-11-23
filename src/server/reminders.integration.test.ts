import assert from "node:assert/strict";
import test from "node:test";

process.env.PG_DATABASE = "barberad_test";

test("avisos por WhatsApp y cancelación por el cliente", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });

  const auth = await import("./auth.ts");
  const shop = await import("./shop.ts");
  const agenda = await import("./agenda.ts");
  const rem = await import("./reminders.ts");
  const { appDb } = await import("./db.ts");

  const owner = await auth.createOwnerAccount({ email: "d@r.local", password: "clave-segura", ownerName: "Ana", shopName: "Navaja", takesAppointments: true });
  await auth.addBarberAccount(owner, { email: "c@r.local", password: "clave-segura", displayName: "Camilo", commissionPercent: 50 });
  const [found] = await appDb()<{ id: string }[]>`select user_id as id from app_find_user_by_email('c@r.local')`;
  const barber = (await auth.contextForUser(found.id))!;
  await shop.createService(owner, { name: "Corte", durationMin: 30, listPrice: 20000 });
  const [service] = await shop.listServices(owner, true);

  const today = await agenda.shopToday(owner);
  const tomorrow = agenda.addDays(today, 1);
  // Una hora más tarde, en la hora de Bogotá.
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(soon);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const soonDay = `${get("year")}-${get("month")}-${get("day")}`;
  const soonTime = `${get("hour")}:${get("minute")}`;

  const add = (ctx: typeof owner, memberId: string, day: string, time: string, name: string, phone: string) =>
    agenda.createStaffAppointment(ctx, { memberId, serviceId: service.id, day, time, clientName: name, phone });
  await add(owner, barber.memberId, tomorrow === soonDay ? agenda.addDays(tomorrow, 0) : tomorrow, soonDay === tomorrow ? "05:00" : "10:00", "Luis Pérez", "3001110001");
  await add(owner, owner.memberId, soonDay, soonTime, "Pedro", "3001110002");
  await add(owner, barber.memberId, agenda.addDays(today, -1), "10:00", "Sofía", "3001110003");
  await add(owner, owner.memberId, agenda.addDays(today, -30), "10:00", "Marta", "3001110004");

  // Se atienden y cobran las dos citas pasadas.
  for (const day of [agenda.addDays(today, -1), agenda.addDays(today, -30)]) {
    const [a] = (await agenda.dayAgenda(owner, day)).appointments;
    await shop.completeCheckout(owner, { serviceId: service.id, amount: 20000, reason: "", tip: 0, paymentMethod: "cash", clientKey: crypto.randomUUID(), appointmentId: a.id });
  }

  const queue = await rem.reminderQueue(owner);
  assert.deepEqual(queue.tomorrow.map((i) => i.clientName), soonDay === tomorrow ? ["Luis Pérez", "Pedro"] : ["Luis Pérez"]);
  assert.deepEqual(queue.soon.map((i) => i.clientName), ["Pedro"]);
  assert.deepEqual(queue.thanks.map((i) => i.clientName).sort(), ["Marta", "Sofía"]);
  assert.deepEqual(queue.comeback.map((i) => i.clientName), ["Marta"]);
  const luis = queue.tomorrow.find((i) => i.clientName === "Luis Pérez")!;
  const text = decodeURIComponent(luis.url.split("?text=")[1]);
  assert.ok(luis.url.startsWith("https://wa.me/573001110001?text="));
  assert.match(text, /^Hola Luis, te recordamos tu cita en Navaja: .* a las \d\d:\d\d, Corte con Camilo\. Si no puedes venir, cancélala aquí: http.*\/c\/[0-9a-f]{32}$/);

  // El barbero solo ve los avisos de sus citas.
  const mine = await rem.reminderQueue(barber);
  assert.deepEqual(mine.tomorrow.map((i) => i.clientName), ["Luis Pérez"]);
  assert.deepEqual(mine.thanks.map((i) => i.clientName), ["Sofía"]);
  assert.equal(mine.soon.length + mine.comeback.length, 0);
  await assert.rejects(() => rem.markReminderSent(barber, "comeback", queue.comeback[0].id), /Solo el dueño/);

  await rem.markReminderSent(barber, "tomorrow", luis.id);
  await rem.markReminderSent(owner, "soon", queue.soon[0].id);
  await rem.markReminderSent(owner, "comeback", queue.comeback[0].id);
  const after = await rem.reminderQueue(owner);
  assert.equal(after.tomorrow.length + after.soon.length + after.comeback.length, 0);
  assert.equal(await rem.pendingReminderCount(owner), 2);

  // Mensajes propios de la barbería.
  await assert.rejects(() => rem.saveTemplates(barber, { reminder: "x", thanks: "x", comeback: "x" }), /Solo el dueño/);
  await assert.rejects(() => rem.saveTemplates(owner, { reminder: " ", thanks: "x", comeback: "x" }), /vacío/);
  await rem.saveTemplates(owner, { reminder: "Hey {nombre} {desconocido}", thanks: "Gracias {nombre} de {barberia}", comeback: "Vuelve {nombre}" });
  const custom = await rem.reminderQueue(owner);
  assert.equal(decodeURIComponent(custom.thanks.find((i) => i.clientName === "Sofía")!.url.split("?text=")[1]), "Gracias Sofía de Navaja");
  assert.equal(rem.fillTemplate("Hola {nombre} {otro}", { nombre: "Ana" }), "Hola Ana {otro}");

  // El cliente cancela desde su enlace y la hora queda libre.
  const slug = (await agenda.shopSlug(owner))!;
  const pub = (await agenda.publicShop(slug))!;
  let day = tomorrow;
  while (new Date(`${day}T12:00:00Z`).getUTCDay() === 0) day = agenda.addDays(day, 1);
  const slots = await agenda.freeSlots({ shopId: pub.id, timezone: pub.timezone, serviceId: service.id, memberId: barber.memberId, day });
  const booked = await agenda.bookPublic({ slug, serviceId: service.id, memberId: barber.memberId, startsAt: slots[0].startsAt, name: "Juan", phone: "3009990000" });
  assert.match(booked.token, /^[0-9a-f]{32}$/);
  const seen = await rem.clientAppointment(booked.token);
  assert.equal(seen?.canCancel, true);
  assert.equal(seen?.memberName, "Camilo");
  assert.equal(await rem.clientAppointment("0".repeat(32)), null);
  assert.equal(await rem.clientAppointment("no-es-un-token"), null);
  assert.equal(await rem.cancelByClient(booked.token), true);
  assert.equal(await rem.cancelByClient(booked.token), false);
  const cancelled = await rem.clientAppointment(booked.token);
  assert.equal(cancelled?.status, "cancelled");
  assert.equal(cancelled?.cancelledByClient, true);
  const again = await agenda.freeSlots({ shopId: pub.id, timezone: pub.timezone, serviceId: service.id, memberId: barber.memberId, day });
  assert.equal(again[0].startsAt, slots[0].startsAt);
});
