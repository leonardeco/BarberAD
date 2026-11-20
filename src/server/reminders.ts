import { appDb, withShop } from "./db";
import { ShopError } from "./errors";
import { appUrl } from "./mail";
import type { ShopContext } from "./types";
import { isUuid, timeLabel } from "./agenda";

export type Templates = { reminder: string; thanks: string; comeback: string };
export type ReminderKind = "tomorrow" | "soon" | "thanks" | "comeback";

export type ReminderItem = {
  kind: ReminderKind;
  id: string;
  clientName: string;
  detail: string;
  url: string;
};

export const placeholders = ["{nombre}", "{barberia}", "{fecha}", "{hora}", "{servicio}", "{barbero}", "{cancelar}", "{enlace}"];

export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}

export function whatsappUrl(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function longDate(iso: string | Date, timezone: string) {
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" });
}

export async function getTemplates(ctx: ShopContext): Promise<Templates> {
  const rows = await withShop(ctx, (tx) => tx<Templates[]>`
    select msg_reminder as reminder, msg_thanks as thanks, msg_comeback as comeback
    from shops where id = ${ctx.shopId}::uuid
  `);
  if (!rows[0]) throw new ShopError("No encontramos la barbería.");
  return rows[0];
}

export async function saveTemplates(ctx: ShopContext, input: Templates) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede cambiar los mensajes.");
  const clean = {
    reminder: input.reminder.trim(),
    thanks: input.thanks.trim(),
    comeback: input.comeback.trim(),
  };
  for (const text of Object.values(clean)) {
    if (!text) throw new ShopError("Ningún mensaje puede quedar vacío.");
    if (text.length > 600) throw new ShopError("Cada mensaje puede tener máximo 600 caracteres.");
  }
  await withShop(ctx, (tx) => tx`
    update shops set msg_reminder = ${clean.reminder}, msg_thanks = ${clean.thanks}, msg_comeback = ${clean.comeback}
    where id = ${ctx.shopId}::uuid
  `);
}

type AppointmentRow = {
  id: string;
  client_name: string;
  phone: string;
  service_name: string;
  member_name: string;
  starts_at: Date;
  client_token: string;
};

// La cola de avisos por enviar. El barbero ve los de sus citas; el dueño, todos, y además los de "vuelve pronto".
export async function reminderQueue(ctx: ShopContext) {
  const base = appUrl();
  return withShop(ctx, async (tx) => {
    const [shop] = await tx<(Templates & { name: string; slug: string; timezone: string })[]>`
      select name, slug, timezone, msg_reminder as reminder, msg_thanks as thanks, msg_comeback as comeback
      from shops where id = ${ctx.shopId}::uuid
    `;
    if (!shop) throw new ShopError("No encontramos la barbería.");
    const bookingLink = `${base}/r/${shop.slug}`;

    const appointmentQuery = (kind: "tomorrow" | "soon" | "thanks") => tx<AppointmentRow[]>`
      select a.id, c.name as client_name, c.phone, a.service_name, m.display_name as member_name,
             a.starts_at, a.client_token
      from appointments a
      join clients c on c.id = a.client_id
      join shop_members m on m.id = a.member_id
      where a.shop_id = ${ctx.shopId}::uuid
        and (
          (${kind} = 'tomorrow' and a.status = 'booked' and a.reminded_24_at is null
            and (a.starts_at at time zone ${shop.timezone})::date = (now() at time zone ${shop.timezone})::date + 1)
          or (${kind} = 'soon' and a.status = 'booked' and a.reminded_2h_at is null and a.started_at is null
            and a.starts_at > now() and a.starts_at <= now() + interval '3 hours')
          or (${kind} = 'thanks' and a.status = 'done' and a.thanked_at is null
            and a.closed_at > now() - interval '2 days')
        )
      order by a.starts_at
    `;
    const [tomorrow, soon, thanks] = await Promise.all([
      appointmentQuery("tomorrow"),
      appointmentQuery("soon"),
      appointmentQuery("thanks"),
    ]);

    const toItem = (kind: ReminderKind, row: AppointmentRow, template: string, detail: string): ReminderItem => {
      const text = fillTemplate(template, {
        nombre: row.client_name.split(/\s+/)[0],
        barberia: shop.name,
        fecha: longDate(row.starts_at, shop.timezone),
        hora: timeLabel(row.starts_at, shop.timezone),
        servicio: row.service_name,
        barbero: row.member_name,
        cancelar: `${base}/c/${row.client_token}`,
        enlace: bookingLink,
      });
      return { kind, id: row.id, clientName: row.client_name, detail, url: whatsappUrl(row.phone, text) };
    };

    const label = (row: AppointmentRow) =>
      `${timeLabel(row.starts_at, shop.timezone)} · ${row.service_name}${ctx.role === "owner" ? ` · ${row.member_name}` : ""}`;

    let comeback: ReminderItem[] = [];
    if (ctx.role === "owner") {
      const rows = await tx<{ id: string; name: string; phone: string; last_visit: Date; visits: number }[]>`
        select c.id, c.name, c.phone, max(a.starts_at) as last_visit, count(*)::int as visits
        from clients c
        join appointments a on a.client_id = c.id and a.status = 'done'
        where c.shop_id = ${ctx.shopId}::uuid
          and (c.last_nudged_at is null or c.last_nudged_at < now() - interval '30 days')
          and not exists (
            select 1 from appointments f
            where f.client_id = c.id and f.status = 'booked' and f.starts_at > now()
          )
        group by c.id
        having max(a.starts_at) < now() - interval '21 days' and max(a.starts_at) > now() - interval '120 days'
        order by max(a.starts_at)
        limit 30
      `;
      comeback = rows.map((row) => {
        const days = Math.floor((Date.now() - row.last_visit.getTime()) / 86_400_000);
        const text = fillTemplate(shop.comeback, {
          nombre: row.name.split(/\s+/)[0],
          barberia: shop.name,
          enlace: bookingLink,
        });
        return {
          kind: "comeback" as const,
          id: row.id,
          clientName: row.name,
          detail: `Vino hace ${days} días · ${row.visits === 1 ? "1 visita" : `${row.visits} visitas`}`,
          url: whatsappUrl(row.phone, text),
        };
      });
    }

    return {
      tomorrow: tomorrow.map((row) => toItem("tomorrow", row, shop.reminder, label(row))),
      soon: soon.map((row) => toItem("soon", row, shop.reminder, label(row))),
      thanks: thanks.map((row) => toItem("thanks", row, shop.thanks, label(row))),
      comeback,
    };
  });
}

export async function pendingReminderCount(ctx: ShopContext) {
  const queue = await reminderQueue(ctx);
  return queue.tomorrow.length + queue.soon.length + queue.thanks.length + queue.comeback.length;
}

export async function markReminderSent(ctx: ShopContext, kind: ReminderKind, id: string) {
  if (!isUuid(id)) throw new ShopError("Ese aviso no existe.");
  if (kind === "comeback") {
    if (ctx.role !== "owner") throw new ShopError("Solo el dueño envía estos mensajes.");
    await withShop(ctx, (tx) => tx`
      update clients set last_nudged_at = now() where id = ${id}::uuid and shop_id = ${ctx.shopId}::uuid
    `);
    return;
  }
  await withShop(ctx, (tx) => {
    if (kind === "tomorrow") {
      return tx`update appointments set reminded_24_at = now() where id = ${id}::uuid and shop_id = ${ctx.shopId}::uuid`;
    }
    if (kind === "soon") {
      // Si ya le llegó el de 2 horas, el de mañana sobra.
      return tx`
        update appointments set reminded_2h_at = now(), reminded_24_at = coalesce(reminded_24_at, now())
        where id = ${id}::uuid and shop_id = ${ctx.shopId}::uuid
      `;
    }
    return tx`update appointments set thanked_at = now() where id = ${id}::uuid and shop_id = ${ctx.shopId}::uuid`;
  });
}

// ---------- Enlace del cliente ----------

export type ClientAppointment = {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  slug: string;
  timezone: string;
  serviceName: string;
  memberName: string;
  clientName: string;
  startsAt: string;
  status: "booked" | "done" | "cancelled" | "no_show";
  cancelledByClient: boolean;
  canCancel: boolean;
};

export async function clientAppointment(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const rows = await appDb()<{ app_public_appointment: ClientAppointment | null }[]>`
    select app_public_appointment(${token})
  `;
  return rows[0]?.app_public_appointment ?? null;
}

export async function cancelByClient(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return false;
  const rows = await appDb()<{ app_public_cancel: boolean }[]>`select app_public_cancel(${token})`;
  return rows[0]?.app_public_cancel ?? false;
}
