import { appDb, withShop } from "./db";
import { ShopError, messageFromDatabase } from "./errors";
import type { ShopContext } from "./types";
import { cleanName } from "./validation";

function guard(error: unknown): never {
  if (error instanceof ShopError) throw error;
  const message = messageFromDatabase(error);
  if (message) throw new ShopError(message);
  throw error;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function isDay(value: string) {
  return dayPattern.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function slugify(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : `barberia-${slug || "nueva"}`.slice(0, 50);
}

// Solo dígitos. Un celular colombiano de 10 dígitos queda con el 57 delante, como lo pide WhatsApp.
export function cleanPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) digits = `57${digits}`;
  if (digits.length < 7 || digits.length > 15) throw new ShopError("Escribe un número de WhatsApp válido.");
  return digits;
}

export function timeLabel(iso: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function dayLabel(day: string, style: "long" | "short" = "long") {
  const text = new Date(`${day}T12:00:00Z`).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    weekday: style,
    day: "numeric",
    month: style,
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- Reservas públicas ----------

export type PublicShop = {
  id: string;
  name: string;
  phone: string;
  address: string;
  timezone: string;
  today: string;
  services: { id: string; name: string; durationMin: number; listPrice: number }[];
  barbers: { id: string; name: string }[];
};

export async function publicShop(slug: string) {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const rows = await appDb()<{ app_public_shop: PublicShop | null }[]>`select app_public_shop(${slug})`;
  return rows[0]?.app_public_shop ?? null;
}

export type Slot = { memberId: string; startsAt: string; time: string };

export async function freeSlots(input: { shopId: string; timezone: string; serviceId: string; memberId: string | null; day: string }) {
  if (!isUuid(input.serviceId) || (input.memberId && !isUuid(input.memberId)) || !isDay(input.day)) return [];
  const rows = await appDb()<{ member_id: string; starts_at: Date }[]>`
    select member_id, starts_at
    from app_free_slots(${input.shopId}::uuid, ${input.serviceId}::uuid, ${input.memberId}::uuid, ${input.day}::date)
  `;
  return rows.map((row) => ({
    memberId: row.member_id,
    startsAt: row.starts_at.toISOString(),
    time: timeLabel(row.starts_at, input.timezone),
  }));
}

export async function bookPublic(input: {
  slug: string;
  serviceId: string;
  memberId: string | null;
  startsAt: string;
  name: string;
  phone: string;
}) {
  if (!isUuid(input.serviceId) || (input.memberId && !isUuid(input.memberId))) {
    throw new ShopError("Elige un servicio.");
  }
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new ShopError("Elige una hora.");
  const name = cleanName(input.name, "tu nombre");
  const phone = cleanPhone(input.phone);
  try {
    const rows = await appDb()<{ appointment_id: string; member_name: string; starts_at: Date; ends_at: Date }[]>`
      select * from app_public_book(
        ${input.slug}, ${input.serviceId}::uuid, ${input.memberId}::uuid,
        ${startsAt.toISOString()}::timestamptz, ${name}, ${phone}
      )
    `;
    const row = rows[0];
    if (!row) throw new ShopError("No se pudo reservar. Inténtalo de nuevo.");
    return { id: row.appointment_id, memberName: row.member_name, startsAt: row.starts_at.toISOString() };
  } catch (error) {
    guard(error);
  }
}

// ---------- Agenda del equipo ----------

export type AgendaAppointment = {
  id: string;
  memberId: string;
  memberName: string;
  serviceName: string;
  listPrice: number;
  clientName: string;
  clientPhone: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "done" | "cancelled" | "no_show";
  source: "public" | "staff";
  confirmed: boolean;
  started: boolean;
  charged: number | null;
};

export type AgendaMember = { id: string; name: string; hours: { start: number; end: number }[] };

export async function dayAgenda(ctx: ShopContext, day: string) {
  if (!isDay(day)) throw new ShopError("Fecha no válida.");
  return withShop(ctx, async (tx) => {
    const members = await tx<{ id: string; name: string; start_min: number | null; end_min: number | null }[]>`
      select m.id, m.display_name as name, h.start_min, h.end_min
      from shop_members m
      left join member_hours h on h.member_id = m.id and h.weekday = extract(isodow from ${day}::date)::int
      where m.shop_id = ${ctx.shopId}::uuid and m.active and m.takes_appointments
        and (${ctx.role} = 'owner' or m.id = ${ctx.memberId}::uuid)
      order by (m.id = ${ctx.memberId}::uuid) desc, m.display_name, h.start_min
    `;
    const byMember = new Map<string, AgendaMember>();
    for (const row of members) {
      const member = byMember.get(row.id) ?? { id: row.id, name: row.name, hours: [] };
      if (row.start_min !== null && row.end_min !== null) member.hours.push({ start: row.start_min, end: row.end_min });
      byMember.set(row.id, member);
    }
    const appointments = await tx<(Omit<AgendaAppointment, "startsAt" | "endsAt"> & { startsAt: Date; endsAt: Date })[]>`
      select a.id, a.member_id as "memberId", m.display_name as "memberName",
             a.service_name as "serviceName", a.list_price as "listPrice",
             c.name as "clientName", c.phone as "clientPhone",
             a.starts_at as "startsAt", a.ends_at as "endsAt", a.status, a.source,
             (a.confirmed_at is not null) as confirmed, (a.started_at is not null) as started,
             k.charged + k.tip as charged
      from appointments a
      join shop_members m on m.id = a.member_id
      join clients c on c.id = a.client_id
      left join checkouts k on k.appointment_id = a.id
      join shops s on s.id = a.shop_id
      where a.shop_id = ${ctx.shopId}::uuid
        and (a.starts_at at time zone s.timezone)::date = ${day}::date
      order by a.starts_at
    `;
    const today = await tx<{ day: string }[]>`
      select (now() at time zone timezone)::date::text as day from shops where id = ${ctx.shopId}::uuid
    `;
    return {
      day,
      today: today[0]?.day ?? day,
      members: [...byMember.values()],
      appointments: appointments.map((row) => ({
        ...row,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
      })),
    };
  });
}

export async function createStaffAppointment(
  ctx: ShopContext,
  input: { memberId: string; serviceId: string; day: string; time: string; clientName: string; phone: string },
) {
  if (!isUuid(input.memberId) || !isUuid(input.serviceId)) throw new ShopError("Elige barbero y servicio.");
  if (ctx.role !== "owner" && input.memberId !== ctx.memberId) {
    throw new ShopError("Solo puedes agendar citas en tu propia agenda.");
  }
  if (!isDay(input.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new ShopError("Elige el día y la hora.");
  const clientName = cleanName(input.clientName, "el nombre del cliente");
  const phone = cleanPhone(input.phone);
  try {
    await withShop(ctx, async (tx) => {
      const services = await tx<{ name: string; duration_min: number; list_price: number }[]>`
        select name, duration_min, list_price from services
        where id = ${input.serviceId}::uuid and shop_id = ${ctx.shopId}::uuid and active
      `;
      const service = services[0];
      if (!service) throw new ShopError("Ese servicio no está disponible.");
      const members = await tx<{ id: string }[]>`
        select id from shop_members
        where id = ${input.memberId}::uuid and shop_id = ${ctx.shopId}::uuid and active and takes_appointments
      `;
      if (!members[0]) throw new ShopError("Ese barbero no recibe citas.");
      const clients = await tx<{ id: string }[]>`
        insert into clients (shop_id, name, phone)
        values (${ctx.shopId}::uuid, ${clientName}, ${phone})
        on conflict (shop_id, phone) do update set name = excluded.name
        returning id
      `;
      await tx`
        insert into appointments (shop_id, member_id, service_id, client_id, service_name, list_price, starts_at, ends_at, source)
        select ${ctx.shopId}::uuid, ${input.memberId}::uuid, ${input.serviceId}::uuid, ${clients[0].id}::uuid,
               ${service.name}, ${service.list_price}, start_at, start_at + make_interval(mins => ${service.duration_min}::int), 'staff'
        from (
          select ((${input.day}::date + ${input.time}::time) at time zone s.timezone) as start_at
          from shops s where s.id = ${ctx.shopId}::uuid
        ) t
      `;
    });
  } catch (error) {
    guard(error);
  }
}

export async function cancelAppointment(ctx: ShopContext, appointmentId: string) {
  if (!isUuid(appointmentId)) throw new ShopError("Esa cita no existe.");
  const rows = await withShop(ctx, (tx) => tx`
    update appointments set status = 'cancelled'
    where id = ${appointmentId}::uuid and shop_id = ${ctx.shopId}::uuid and status = 'booked'
    returning id
  `);
  if (!rows[0]) throw new ShopError("Esa cita ya no se puede cancelar.");
}

export type AppointmentStep = "confirm" | "start" | "no_show";

// Avanza una cita reservada: confirmar, sentar en la silla o marcar que no vino.
export async function moveAppointment(ctx: ShopContext, appointmentId: string, step: AppointmentStep) {
  if (!isUuid(appointmentId)) throw new ShopError("Esa cita no existe.");
  const rows = await withShop(ctx, (tx) => {
    if (step === "confirm") {
      return tx`
        update appointments set confirmed_at = coalesce(confirmed_at, now())
        where id = ${appointmentId}::uuid and shop_id = ${ctx.shopId}::uuid and status = 'booked'
        returning id
      `;
    }
    if (step === "start") {
      return tx`
        update appointments set started_at = coalesce(started_at, now()), confirmed_at = coalesce(confirmed_at, now())
        where id = ${appointmentId}::uuid and shop_id = ${ctx.shopId}::uuid and status = 'booked'
        returning id
      `;
    }
    return tx`
      update appointments set status = 'no_show', closed_at = now()
      where id = ${appointmentId}::uuid and shop_id = ${ctx.shopId}::uuid
        and status = 'booked' and started_at is null and starts_at <= now()
      returning id
    `;
  });
  if (!rows[0]) {
    throw new ShopError(
      step === "no_show" ? "Solo se marca \"no vino\" cuando ya pasó la hora y no se sentó." : "Esa cita ya no está pendiente.",
    );
  }
}

export type CheckoutAppointment = {
  id: string;
  clientName: string;
  memberName: string;
  serviceId: string;
  serviceName: string;
  listPrice: number;
  durationMin: number;
  time: string;
};

export async function appointmentForCheckout(ctx: ShopContext, appointmentId: string) {
  if (!isUuid(appointmentId)) return null;
  const rows = await withShop(ctx, (tx) => tx<(Omit<CheckoutAppointment, "time"> & { startsAt: Date })[]>`
    select a.id, c.name as "clientName", m.display_name as "memberName", a.service_id as "serviceId",
           a.service_name as "serviceName", a.list_price as "listPrice",
           (extract(epoch from a.ends_at - a.starts_at) / 60)::int as "durationMin",
           a.starts_at as "startsAt"
    from appointments a
    join clients c on c.id = a.client_id
    join shop_members m on m.id = a.member_id
    where a.id = ${appointmentId}::uuid and a.shop_id = ${ctx.shopId}::uuid and a.status = 'booked'
  `);
  const row = rows[0];
  if (!row) return null;
  const { startsAt, ...rest } = row;
  return { ...rest, time: timeLabel(startsAt, ctx.timezone) };
}

// ---------- Horarios ----------

export type MemberSchedule = {
  id: string;
  name: string;
  role: "owner" | "barber";
  takesAppointments: boolean;
  days: { weekday: number; start: number; end: number }[];
};

export async function listSchedules(ctx: ShopContext) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede ver los horarios.");
  return withShop(ctx, async (tx) => {
    const rows = await tx<{ id: string; name: string; role: "owner" | "barber"; takes: boolean; weekday: number | null; start_min: number | null; end_min: number | null }[]>`
      select m.id, m.display_name as name, m.role, m.takes_appointments as takes,
             h.weekday, h.start_min, h.end_min
      from shop_members m
      left join member_hours h on h.member_id = m.id
      where m.shop_id = ${ctx.shopId}::uuid and m.active
      order by m.role desc, m.display_name, h.weekday, h.start_min
    `;
    const map = new Map<string, MemberSchedule>();
    for (const row of rows) {
      const item = map.get(row.id) ?? { id: row.id, name: row.name, role: row.role, takesAppointments: row.takes, days: [] };
      if (row.weekday !== null && row.start_min !== null && row.end_min !== null) {
        item.days.push({ weekday: row.weekday, start: row.start_min, end: row.end_min });
      }
      map.set(row.id, item);
    }
    return [...map.values()];
  });
}

export async function saveSchedule(
  ctx: ShopContext,
  memberId: string,
  input: { takesAppointments: boolean; days: { weekday: number; start: number; end: number }[] },
) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede cambiar horarios.");
  if (!isUuid(memberId)) throw new ShopError("Ese miembro no existe.");
  for (const day of input.days) {
    if (!Number.isInteger(day.weekday) || day.weekday < 1 || day.weekday > 7) throw new ShopError("Día no válido.");
    if (!Number.isInteger(day.start) || !Number.isInteger(day.end) || day.start < 0 || day.end > 1440 || day.end <= day.start) {
      throw new ShopError("La hora de salida debe ser después de la de entrada.");
    }
  }
  try {
    await withShop(ctx, async (tx) => {
      const rows = await tx`
        update shop_members set takes_appointments = ${input.takesAppointments}
        where id = ${memberId}::uuid and shop_id = ${ctx.shopId}::uuid and active
        returning id
      `;
      if (!rows[0]) throw new ShopError("Ese miembro no existe.");
      await tx`delete from member_hours where member_id = ${memberId}::uuid and shop_id = ${ctx.shopId}::uuid`;
      for (const day of input.days) {
        await tx`
          insert into member_hours (shop_id, member_id, weekday, start_min, end_min)
          values (${ctx.shopId}::uuid, ${memberId}::uuid, ${day.weekday}, ${day.start}, ${day.end})
        `;
      }
    });
  } catch (error) {
    guard(error);
  }
}

// ---------- Clientes ----------

export type ClientRow = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  visits: number;
  noShows: number;
  lastVisit: string | null;
  nextVisit: string | null;
};

export async function listClients(ctx: ShopContext, query: string) {
  const q = query.trim().slice(0, 60);
  const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return withShop(ctx, (tx) => tx<ClientRow[]>`
    select c.id, c.name, c.phone, c.notes,
           count(a.id) filter (where a.status = 'done' or (a.status = 'booked' and a.starts_at < now()))::int as visits,
           count(a.id) filter (where a.status = 'no_show')::int as "noShows",
           to_char(max(a.starts_at at time zone s.timezone) filter (where a.status = 'done' or (a.status = 'booked' and a.starts_at < now())), 'YYYY-MM-DD') as "lastVisit",
           to_char(min(a.starts_at at time zone s.timezone) filter (where a.status = 'booked' and a.starts_at >= now()), 'YYYY-MM-DD HH24:MI') as "nextVisit"
    from clients c
    join shops s on s.id = c.shop_id
    left join appointments a on a.client_id = c.id
    where c.shop_id = ${ctx.shopId}::uuid
      and (${q} = '' or c.name ilike ${like} or c.phone like ${like})
    group by c.id, s.timezone
    order by max(a.starts_at) desc nulls last, c.name
    limit 200
  `);
}

export async function updateClientNotes(ctx: ShopContext, clientId: string, notes: string) {
  if (!isUuid(clientId)) throw new ShopError("Ese cliente no existe.");
  const text = notes.trim();
  if (text.length > 500) throw new ShopError("Las notas son demasiado largas (máximo 500 caracteres).");
  const rows = await withShop(ctx, (tx) => tx`
    update clients set notes = ${text}
    where id = ${clientId}::uuid and shop_id = ${ctx.shopId}::uuid
    returning id
  `);
  if (!rows[0]) throw new ShopError("Ese cliente no existe.");
}

export async function shopSlug(ctx: ShopContext) {
  const rows = await withShop(ctx, (tx) => tx<{ slug: string }[]>`select slug from shops where id = ${ctx.shopId}::uuid`);
  return rows[0]?.slug ?? null;
}

export async function shopToday(ctx: ShopContext) {
  const rows = await withShop(ctx, (tx) => tx<{ day: string }[]>`
    select (now() at time zone timezone)::date::text as day from shops where id = ${ctx.shopId}::uuid
  `);
  return rows[0]?.day ?? new Date().toISOString().slice(0, 10);
}
