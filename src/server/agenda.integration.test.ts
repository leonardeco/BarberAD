import assert from "node:assert/strict";
import test from "node:test";

process.env.PG_DATABASE = "barberad_test";

test("agenda: horas libres, reservas sin cruces y cada uno ve lo suyo", async () => {
  const { ensureLocalPostgres } = await import("./local-postgres.ts");
  const { migrate } = await import("./migrate.ts");
  await ensureLocalPostgres();
  await migrate("barberad_test", { fresh: true });

  const auth = await import("./auth.ts");
  const shop = await import("./shop.ts");
  const agenda = await import("./agenda.ts");
  const { appDb } = await import("./db.ts");

  const owner = await auth.createOwnerAccount({
    email: "dueno@agenda.local",
    password: "clave-segura",
    ownerName: "Ana",
    shopName: "Barbería Él Imperial",
    takesAppointments: true,
  });
  const other = await auth.createOwnerAccount({
    email: "otro@agenda.local",
    password: "clave-segura",
    ownerName: "Bruno",
    shopName: "Barbería Él Imperial",
  });
  await auth.addBarberAccount(owner, {
    email: "camilo@agenda.local",
    password: "clave-segura",
    displayName: "Camilo",
    commissionPercent: 50,
  });
  const [found] = await appDb()<{ id: string }[]>`select user_id as id from app_find_user_by_email('camilo@agenda.local')`;
  const barber = await auth.contextForUser(found.id);
  assert.ok(barber);

  const slugA = await agenda.shopSlug(owner);
  const slugB = await agenda.shopSlug(other);
  assert.equal(slugA, "barberia-el-imperial");
  assert.equal(slugB, "barberia-el-imperial-2");

  await shop.createService(owner, { name: "Corte", durationMin: 30, listPrice: 20000 });
  const [service] = await shop.listServices(owner, true);
  const pub = await agenda.publicShop(slugA!);
  assert.ok(pub);
  assert.equal(pub.barbers.length, 2);
  assert.equal(pub.services.length, 1);

  // Próximo lunes en Bogotá: la barbería abre de 9:00 a 19:00.
  let day = agenda.addDays(pub.today, 1);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() !== 1) day = agenda.addDays(day, 1);
  const base = { shopId: pub.id, timezone: pub.timezone, serviceId: service.id, day };

  const camiloSlots = await agenda.freeSlots({ ...base, memberId: barber.memberId });
  assert.equal(camiloSlots[0].time, "09:00");
  assert.equal(camiloSlots.at(-1)?.time, "18:30");
  assert.equal(camiloSlots.length, 39);

  // Domingo no se trabaja.
  let sunday = day;
  while (new Date(`${sunday}T12:00:00Z`).getUTCDay() !== 0) sunday = agenda.addDays(sunday, 1);
  assert.equal((await agenda.freeSlots({ ...base, day: sunday, memberId: null })).length, 0);

  const nine = camiloSlots[0].startsAt;
  const booked = await agenda.bookPublic({ slug: slugA!, serviceId: service.id, memberId: barber.memberId, startsAt: nine, name: "Luis", phone: "300 123 4567" });
  assert.equal(booked.memberName, "Camilo");
  await assert.rejects(
    () => agenda.bookPublic({ slug: slugA!, serviceId: service.id, memberId: barber.memberId, startsAt: nine, name: "Pedro", phone: "3109998888" }),
    /se acaba de ocupar/,
  );
  const after = await agenda.freeSlots({ ...base, memberId: barber.memberId });
  assert.equal(after[0].time, "09:30", "9:15 se cruza con la cita de 9:00 a 9:30");

  // "Con quien esté libre" a las 9:00 cae en Ana, que sigue libre.
  const any = await agenda.bookPublic({ slug: slugA!, serviceId: service.id, memberId: null, startsAt: nine, name: "Pedro", phone: "3109998888" });
  assert.equal(any.memberName, "Ana");

  // La base de datos tampoco deja cruzar citas agendadas a mano.
  await assert.rejects(
    () => agenda.createStaffAppointment(barber, { memberId: barber.memberId, serviceId: service.id, day, time: "09:15", clientName: "Juan", phone: "3001112222" }),
    /se acaba de ocupar/,
  );
  await assert.rejects(
    () => agenda.createStaffAppointment(barber, { memberId: owner.memberId, serviceId: service.id, day, time: "12:00", clientName: "Juan", phone: "3001112222" }),
    /propia agenda/,
  );
  await agenda.createStaffAppointment(barber, { memberId: barber.memberId, serviceId: service.id, day, time: "20:00", clientName: "Juan", phone: "3001112222" });

  await assert.rejects(
    () => agenda.bookPublic({ slug: slugA!, serviceId: service.id, memberId: null, startsAt: after[1].startsAt, name: "X", phone: "12" }),
    /WhatsApp válido/,
  );

  // Cada uno ve lo suyo.
  const ownerDay = await agenda.dayAgenda(owner, day);
  assert.equal(ownerDay.appointments.length, 3);
  const barberDay = await agenda.dayAgenda(barber, day);
  assert.equal(barberDay.appointments.length, 2);
  assert.deepEqual(barberDay.members.map((m) => m.name), ["Camilo"]);
  assert.equal((await agenda.dayAgenda(other, day)).appointments.length, 0);
  assert.equal((await agenda.listClients(other, "")).length, 0);

  // Cancelar libera la hora.
  await agenda.cancelAppointment(owner, booked.id);
  assert.equal((await agenda.freeSlots({ ...base, memberId: barber.memberId }))[0].time, "09:00");
  await assert.rejects(() => agenda.cancelAppointment(owner, booked.id), /ya no se puede cancelar/);

  // Un mismo número no acapara la agenda.
  const free = await agenda.freeSlots({ ...base, memberId: barber.memberId });
  for (const slot of [free[2], free[4]]) {
    await agenda.bookPublic({ slug: slugA!, serviceId: service.id, memberId: barber.memberId, startsAt: slot.startsAt, name: "Pedro", phone: "3109998888" });
  }
  await assert.rejects(
    () => agenda.bookPublic({ slug: slugA!, serviceId: service.id, memberId: barber.memberId, startsAt: free[6].startsAt, name: "Pedro", phone: "3109998888" }),
    /3 citas pendientes/,
  );

  const clients = await agenda.listClients(owner, "pedro");
  assert.equal(clients.length, 1);
  assert.equal(clients[0].phone, "573109998888");
  await agenda.updateClientNotes(owner, clients[0].id, "Fade 1.5");
  assert.equal((await agenda.listClients(barber, "310"))[0].notes, "Fade 1.5");

  // Horarios: solo el dueño; apagar la agenda saca al barbero del enlace.
  await assert.rejects(() => agenda.saveSchedule(barber, barber.memberId, { takesAppointments: true, days: [] }), /Solo el dueño/);
  await agenda.saveSchedule(owner, barber.memberId, { takesAppointments: false, days: [{ weekday: 1, start: 600, end: 720 }] });
  assert.deepEqual((await agenda.publicShop(slugA!))?.barbers.map((b) => b.name), ["Ana"]);
  await assert.rejects(
    () => agenda.saveSchedule(owner, barber.memberId, { takesAppointments: true, days: [{ weekday: 1, start: 720, end: 600 }] }),
    /después de la de entrada/,
  );
});
