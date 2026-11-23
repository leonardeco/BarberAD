import { withShop, type ShopTx } from "./db";
import { ShopError, messageFromDatabase } from "./errors";
import { MAX_DRAWER_PESOS, commissionAmount, deriveMoney, wholePesos } from "./money";
import type { CheckoutReceipt, PaymentMethod, ShopContext } from "./types";
import { checkCommission, checkDuration, cleanName } from "./validation";

function guard(error: unknown): never {
  if (error instanceof ShopError) throw error;
  const message = messageFromDatabase(error);
  if (message) throw new ShopError(message);
  throw error;
}

export type ServiceRow = {
  id: string;
  name: string;
  duration_min: number;
  list_price: number;
  commission_percent: number | null;
  active: boolean;
};

function checkServiceCommission(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  checkCommission(value);
  return value;
}

export async function createService(
  ctx: ShopContext,
  input: { name: string; durationMin: number; listPrice: number; commissionPercent?: number | null },
) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede crear servicios.");
  const servicePercent = checkServiceCommission(input.commissionPercent);
  const name = cleanName(input.name, "el nombre del servicio");
  checkDuration(input.durationMin);
  wholePesos(input.listPrice, "El precio");
  try {
    await withShop(ctx, (tx) => tx`
      insert into services (shop_id, name, duration_min, list_price, commission_percent)
      values (${ctx.shopId}::uuid, ${name}, ${input.durationMin}, ${input.listPrice}, ${servicePercent})
    `);
  } catch (error) {
    guard(error);
  }
}

export async function updateService(
  ctx: ShopContext,
  serviceId: string,
  input: { name: string; durationMin: number; listPrice: number; commissionPercent?: number | null },
) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede editar servicios.");
  const servicePercent = checkServiceCommission(input.commissionPercent);
  const name = cleanName(input.name, "el nombre del servicio");
  checkDuration(input.durationMin);
  wholePesos(input.listPrice, "El precio");
  const rows = await withShop(ctx, (tx) => tx`
    update services
    set name = ${name}, duration_min = ${input.durationMin}, list_price = ${input.listPrice},
        commission_percent = ${servicePercent}
    where id = ${serviceId}::uuid and shop_id = ${ctx.shopId}::uuid
    returning id
  `);
  if (!rows[0]) throw new ShopError("Ese servicio no existe.");
}

export async function deactivateService(ctx: ShopContext, serviceId: string) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede desactivar servicios.");
  await withShop(ctx, (tx) => tx`
    update services set active = false
    where id = ${serviceId}::uuid and shop_id = ${ctx.shopId}::uuid
  `);
}

export async function listServices(ctx: ShopContext, activeOnly: boolean) {
  return withShop(ctx, (tx) => tx<ServiceRow[]>`
    select id, name, duration_min, list_price, commission_percent, active
    from services
    where shop_id = ${ctx.shopId}::uuid
      and (${activeOnly} = false or active = true)
    order by active desc, name
  `);
}

export type MemberRow = {
  id: string;
  display_name: string;
  role: "owner" | "barber";
  commission_percent: number;
  active: boolean;
};

export async function listMembers(ctx: ShopContext) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede ver el equipo.");
  return withShop(ctx, (tx) => tx<MemberRow[]>`
    select id, display_name, role, commission_percent, active
    from shop_members
    where shop_id = ${ctx.shopId}::uuid
    order by role desc, display_name
  `);
}

export async function deactivateMember(ctx: ShopContext, memberId: string) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede desactivar un barbero.");
  if (memberId === ctx.memberId) throw new ShopError("No puedes desactivar tu propio acceso.");
  await withShop(ctx, (tx) => tx`
    update shop_members set active = false
    where id = ${memberId}::uuid
      and shop_id = ${ctx.shopId}::uuid
      and role = 'barber'
  `);
}

export async function updateCommission(ctx: ShopContext, memberId: string, percent: number) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede cambiar comisiones.");
  checkCommission(percent);
  const rows = await withShop(ctx, (tx) => tx`
    update shop_members set commission_percent = ${percent}
    where id = ${memberId}::uuid
      and shop_id = ${ctx.shopId}::uuid
      and role = 'barber'
    returning id
  `);
  if (!rows[0]) throw new ShopError("Ese barbero no existe.");
}

export type ShopProfile = { name: string; phone: string; address: string; about: string; instagram: string };

export async function shopProfile(ctx: ShopContext) {
  const rows = await withShop(ctx, (tx) => tx<ShopProfile[]>`
    select name, phone, address, about, instagram from shops where id = ${ctx.shopId}::uuid
  `);
  if (!rows[0]) throw new ShopError("No encontramos la barbería.");
  return rows[0];
}

export async function updateShopProfile(
  ctx: ShopContext,
  input: Omit<ShopProfile, "about" | "instagram"> & Partial<Pick<ShopProfile, "about" | "instagram">>,
) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede editar la barbería.");
  const name = cleanName(input.name, "el nombre de la barbería");
  const phone = input.phone.trim();
  const address = input.address.trim();
  if (phone && !/^[0-9+\s()-]{7,20}$/.test(phone)) {
    throw new ShopError("Escribe un teléfono válido, solo números.");
  }
  if (address.length > 160) throw new ShopError("La dirección es demasiado larga.");
  const about = (input.about ?? "").trim();
  if (about.length > 400) throw new ShopError("La descripción puede tener máximo 400 caracteres.");
  const instagram = (input.instagram ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
  if (!/^[A-Za-z0-9._]{0,30}$/.test(instagram)) throw new ShopError("Escribe solo tu usuario de Instagram, sin espacios.");
  await withShop(ctx, (tx) => tx`
    update shops set name = ${name}, phone = ${phone}, address = ${address}, about = coalesce(${input.about === undefined ? null : about}, about),
        instagram = coalesce(${input.instagram === undefined ? null : instagram}, instagram)
    where id = ${ctx.shopId}::uuid
  `);
}

export async function setGuideHidden(ctx: ShopContext, hidden: boolean) {
  if (ctx.role !== "owner") return;
  await withShop(ctx, (tx) => tx`
    update shops set guide_hidden = ${hidden} where id = ${ctx.shopId}::uuid
  `);
}

export type GuideStep = { id: string; title: string; detail: string; href: string; done: boolean };

export async function guideStatus(ctx: ShopContext) {
  if (ctx.role !== "owner") return null;
  const rows = await withShop(ctx, (tx) => tx<{
    phone: string;
    address: string;
    guide_hidden: boolean;
    services: number;
    barbers: number;
    charged: boolean;
  }[]>`
    select s.phone, s.address, s.guide_hidden,
           (select count(*)::int from services where shop_id = s.id and active) as services,
           (select count(*)::int from shop_members where shop_id = s.id and role = 'barber') as barbers,
           exists (select 1 from checkouts where shop_id = s.id) as charged
    from shops s
    where s.id = ${ctx.shopId}::uuid
  `);
  const row = rows[0];
  if (!row) return null;
  const steps: GuideStep[] = [
    {
      id: "services",
      title: "Arma tu carta",
      detail: "Agrega los cortes que ofreces con su precio.",
      href: "/servicios",
      done: row.services > 0,
    },
    {
      id: "charge",
      title: "Cobra tu primer corte",
      detail: "Tres toques: servicio, monto y pago.",
      href: "/cobrar",
      done: row.charged,
    },
    {
      id: "team",
      title: "Suma a tu equipo",
      detail: "Cada barbero entra con su correo. Si trabajas solo, sáltalo.",
      href: "/equipo",
      done: row.barbers > 0,
    },
    {
      id: "profile",
      title: "Completa los datos de la barbería",
      detail: "Teléfono y dirección, para tus clientes.",
      href: "/cuenta",
      done: row.phone.length > 0 && row.address.length > 0,
    },
  ];
  const done = steps.filter((step) => step.done).length;
  return { steps, done, hidden: row.guide_hidden || done === steps.length };
}

const methods = new Set<PaymentMethod>(["cash", "transfer", "card"]);

async function businessDate(tx: ShopTx, ctx: ShopContext) {
  const rows = await tx<{ day: string }[]>`
    select (now() at time zone timezone)::date::text as day
    from shops
    where id = ${ctx.shopId}::uuid
  `;
  const day = rows[0]?.day;
  if (!day) throw new ShopError("No encontramos la barbería.");
  return day;
}

export async function completeCheckout(
  ctx: ShopContext,
  input: {
    serviceId: string;
    amount: number;
    reason: string;
    tip: number;
    paymentMethod: string;
    clientKey: string;
    appointmentId?: string | null;
    memberId?: string | null;
  },
): Promise<CheckoutReceipt> {
  if (!methods.has(input.paymentMethod as PaymentMethod)) {
    throw new ShopError("Elige efectivo, transferencia o tarjeta.");
  }
  const paymentMethod = input.paymentMethod as PaymentMethod;
  wholePesos(input.tip, "La propina");
  if (!/^[0-9a-f-]{36}$/i.test(input.clientKey)) {
    throw new ShopError("No se pudo confirmar el cobro. Inténtalo de nuevo.");
  }
  try {
    return await withShop(ctx, async (tx) => {
      const existing = await tx<CheckoutReceipt[]>`
        select id, service_name as "serviceName", charged, tip,
               commission_amount as "commissionAmount",
               payment_method as "paymentMethod"
        from checkouts
        where shop_id = ${ctx.shopId}::uuid and client_key = ${input.clientKey}::uuid
      `;
      if (existing[0]) return existing[0];

      // Por defecto cobra quien está en sesión, con su comisión. Si viene de una cita,
      // el cobro es del barbero de la cita, al precio que tenía cuando se reservó.
      let memberId = ctx.memberId;
      let commissionPercent = ctx.commissionPercent;
      let serviceId = input.serviceId;
      let service: { name: string; list_price: number } | undefined;
      const appointmentId = input.appointmentId || null;
      if (appointmentId) {
        if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) throw new ShopError("Esa cita no existe.");
        const rows = await tx<{
          member_id: string;
          service_id: string;
          service_name: string;
          list_price: number;
          status: string;
          commission_percent: number;
        }[]>`
          select a.member_id, a.service_id, a.service_name, a.list_price, a.status,
                 case when m.role = 'owner' then 100 else coalesce(v.commission_percent, m.commission_percent) end as commission_percent
          from appointments a
          join shop_members m on m.id = a.member_id
          join services v on v.id = a.service_id
          where a.id = ${appointmentId}::uuid and a.shop_id = ${ctx.shopId}::uuid
          for update of a
        `;
        const appointment = rows[0];
        if (!appointment) throw new ShopError("Esa cita no existe.");
        if (appointment.status === "done") throw new ShopError("Esa cita ya se cobró.");
        if (appointment.status !== "booked") throw new ShopError("Esa cita está cancelada o marcada como que no vino.");
        if (ctx.role !== "owner" && appointment.member_id !== ctx.memberId) {
          throw new ShopError("Esa cita es de otro barbero.");
        }
        memberId = appointment.member_id;
        commissionPercent = appointment.commission_percent;
        serviceId = appointment.service_id;
        service = { name: appointment.service_name, list_price: appointment.list_price };
      } else {
        // El dueño puede registrar el cobro a nombre de un barbero.
        if (input.memberId && input.memberId !== ctx.memberId) {
          if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede cobrar a nombre de otro.");
          if (!/^[0-9a-f-]{36}$/i.test(input.memberId)) throw new ShopError("Ese barbero no existe.");
          memberId = input.memberId;
        }
        const services = await tx<{ name: string; list_price: number; commission_percent: number }[]>`
          select v.name, v.list_price,
                 case when m.role = 'owner' then 100 else coalesce(v.commission_percent, m.commission_percent) end as commission_percent
          from services v
          join shop_members m on m.id = ${memberId}::uuid and m.shop_id = v.shop_id and m.active
          where v.id = ${input.serviceId}::uuid and v.shop_id = ${ctx.shopId}::uuid and v.active
        `;
        service = services[0];
        if (service) commissionPercent = services[0].commission_percent;
      }
      if (!service) throw new ShopError("Ese servicio no está disponible.");
      const money = deriveMoney(service.list_price, input.amount, input.reason);
      const commission = commissionAmount(money.charged, commissionPercent);
      const day = await businessDate(tx, ctx);
      await tx`
        insert into cash_drawers (shop_id, business_date, status)
        values (${ctx.shopId}::uuid, ${day}::date, 'open')
        on conflict (shop_id, business_date) do nothing
      `;
      const inserted = await tx<CheckoutReceipt[]>`
        insert into checkouts (
          shop_id, member_id, service_id, service_name, business_date,
          list_price, extras, discount, discount_reason, charged, tip,
          currency, payment_method, commission_percent, commission_amount, client_key, appointment_id
        ) values (
          ${ctx.shopId}::uuid, ${memberId}::uuid, ${serviceId}::uuid,
          ${service.name}, ${day}::date, ${money.listPrice}, ${money.extras},
          ${money.discount}, ${money.discountReason}, ${money.charged}, ${input.tip},
          ${ctx.currency}, ${paymentMethod}, ${commissionPercent}, ${commission},
          ${input.clientKey}::uuid, ${appointmentId}::uuid
        )
        returning id, service_name as "serviceName", charged, tip,
                  commission_amount as "commissionAmount",
                  payment_method as "paymentMethod"
      `;
      if (appointmentId) {
        await tx`
          update appointments set status = 'done', closed_at = now()
          where id = ${appointmentId}::uuid and shop_id = ${ctx.shopId}::uuid
        `;
      }
      return inserted[0];
    });
  } catch (error) {
    guard(error);
  }
}

export type TodayCheckout = CheckoutReceipt & {
  barberName: string;
  memberId: string;
  isOwner: boolean;
  time: string;
  listPrice: number;
  discount: number;
  discountReason: string;
};

export type BarberDay = {
  memberId: string;
  name: string;
  isOwner: boolean;
  cuts: number;
  charged: number;
  commission: number;
  tips: number;
};

export async function listToday(ctx: ShopContext) {
  return withShop(ctx, async (tx) => {
    const day = await businessDate(tx, ctx);
    const drawer = await tx<{ status: "open" | "closed" }[]>`
      select status from cash_drawers
      where shop_id = ${ctx.shopId}::uuid and business_date = ${day}::date
    `;
    const checkouts = await tx<TodayCheckout[]>`
      select c.id, c.service_name as "serviceName", c.charged, c.tip,
             c.commission_amount as "commissionAmount",
             c.payment_method as "paymentMethod",
             c.member_id as "memberId",
             c.list_price as "listPrice",
             c.discount,
             c.discount_reason as "discountReason",
             to_char(c.completed_at at time zone s.timezone, 'HH24:MI') as time,
             m.display_name as "barberName",
             (m.role = 'owner') as "isOwner"
      from live_checkouts c
      join shop_members m on m.id = c.member_id
      join shops s on s.id = c.shop_id
      where c.shop_id = ${ctx.shopId}::uuid and c.business_date = ${day}::date
      order by c.completed_at desc
    `;
    const byMethod = { cash: 0, transfer: 0, card: 0 };
    const barbers = new Map<string, BarberDay>();
    let charged = 0;
    let tips = 0;
    let commission = 0;
    for (const row of checkouts) {
      byMethod[row.paymentMethod] += row.charged + row.tip;
      charged += row.charged;
      tips += row.tip;
      // Lo que el dueño cobra con sus propias manos no es una comisión que se le deba al equipo.
      if (!row.isOwner) commission += row.commissionAmount;
      const barber = barbers.get(row.memberId) ?? {
        memberId: row.memberId,
        name: row.barberName,
        isOwner: row.isOwner,
        cuts: 0,
        charged: 0,
        commission: 0,
        tips: 0,
      };
      barber.cuts += 1;
      barber.charged += row.charged;
      barber.commission += row.commissionAmount;
      barber.tips += row.tip;
      barbers.set(row.memberId, barber);
    }
    const voided = await tx<{ id: string; serviceName: string; charged: number; tip: number; barberName: string; reason: string; time: string }[]>`
      select c.id, c.service_name as "serviceName", c.charged, c.tip, m.display_name as "barberName",
             v.reason, to_char(c.completed_at at time zone s.timezone, 'HH24:MI') as time
      from checkouts c
      join checkout_voids v on v.checkout_id = c.id
      join shop_members m on m.id = c.member_id
      join shops s on s.id = c.shop_id
      where c.shop_id = ${ctx.shopId}::uuid and c.business_date = ${day}::date
      order by c.completed_at desc
    `;
    return {
      day,
      voided,
      drawerStatus: drawer[0]?.status ?? "open",
      checkouts,
      expectedCash: byMethod.cash,
      byMethod,
      charged,
      tips,
      commission,
      averageTicket: checkouts.length ? Math.round(charged / checkouts.length) : 0,
      discounts: checkouts.filter((row) => row.discount > 0).length,
      barbers: [...barbers.values()].sort((a, b) => b.charged - a.charged),
    };
  });
}

export async function recentDrawers(ctx: ShopContext) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede ver los cierres.");
  return withShop(ctx, (tx) => tx<{
    day: string;
    expectedCash: number;
    countedCash: number;
  }[]>`
    select business_date::text as day,
           expected_cash as "expectedCash",
           counted_cash as "countedCash"
    from cash_drawers
    where shop_id = ${ctx.shopId}::uuid and status = 'closed'
    order by business_date desc
    limit 7
  `);
}

export async function visibleCheckoutIds(ctx: ShopContext) {
  return withShop(ctx, (tx) => tx<{ id: string }[]>`select id from checkouts`);
}

export async function closeDrawer(ctx: ShopContext, countedCash: number) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede cerrar la caja.");
  wholePesos(countedCash, "El efectivo contado", MAX_DRAWER_PESOS);
  try {
    return await withShop(ctx, async (tx) => {
      const day = await businessDate(tx, ctx);
      await tx`
        insert into cash_drawers (shop_id, business_date, status)
        values (${ctx.shopId}::uuid, ${day}::date, 'open')
        on conflict (shop_id, business_date) do nothing
      `;
      // Se bloquea la caja del día ANTES de sumar. Un cobro que entre a la vez espera
      // aquí (su trigger pide el mismo candado): o queda dentro de la suma, o se rechaza
      // por caja cerrada. Nunca queda un cobro en efectivo fuera del esperado.
      const locked = await tx<{ status: string }[]>`
        select status from cash_drawers
        where shop_id = ${ctx.shopId}::uuid and business_date = ${day}::date
        for update
      `;
      if (locked[0]?.status === "closed") throw new ShopError("La caja de hoy ya está cerrada.");
      const today = await listInside(tx, ctx, day);
      const rows = await tx<{ status: string }[]>`
        update cash_drawers
        set status = 'closed',
            closed_at = now(),
            closed_by_member_id = ${ctx.memberId}::uuid,
            expected_cash = ${today.expectedCash},
            counted_cash = ${countedCash}
        where shop_id = ${ctx.shopId}::uuid and business_date = ${day}::date
        returning status
      `;
      if (!rows[0]) throw new ShopError("No se pudo cerrar la caja.");
      return {
        expectedCash: today.expectedCash,
        countedCash,
        difference: countedCash - today.expectedCash,
      };
    });
  } catch (error) {
    guard(error);
  }
}

async function listInside(tx: ShopTx, ctx: ShopContext, day: string) {
  const checkouts = await tx<{ charged: number; tip: number; payment_method: PaymentMethod }[]>`
    select charged, tip, payment_method
    from live_checkouts
    where shop_id = ${ctx.shopId}::uuid and business_date = ${day}::date
  `;
  const expectedCash = checkouts
    .filter((row) => row.payment_method === "cash")
    .reduce((sum, row) => sum + row.charged + row.tip, 0);
  return { expectedCash };
}

// Anula un cobro sin borrarlo: queda registrado aparte, con motivo y quién lo anuló, y deja de contar en la caja,
// los reportes y la liquidación. Si venía de una cita, la cita vuelve a quedar por cobrar.
export async function voidCheckout(ctx: ShopContext, checkoutId: string, reason: string) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede anular un cobro.");
  if (!/^[0-9a-f-]{36}$/i.test(checkoutId)) throw new ShopError("Ese cobro no existe.");
  const why = reason.trim();
  if (!why) throw new ShopError("Escribe por qué lo anulas.");
  if (why.length > 120) throw new ShopError("El motivo es demasiado largo (máximo 120 caracteres).");
  try {
    await withShop(ctx, async (tx) => {
      const rows = await tx<{ member_id: string; business_date: string; appointment_id: string | null }[]>`
        select member_id, business_date::text as business_date, appointment_id
        from checkouts where id = ${checkoutId}::uuid and shop_id = ${ctx.shopId}::uuid
      `;
      const checkout = rows[0];
      if (!checkout) throw new ShopError("Ese cobro no existe.");
      // Mismos candados que el cierre de caja y la liquidación, para no cruzarse con ellos.
      await tx`select id from shop_members where id = ${checkout.member_id}::uuid for update`;
      const drawer = await tx<{ status: string }[]>`
        select status from cash_drawers
        where shop_id = ${ctx.shopId}::uuid and business_date = ${checkout.business_date}::date
        for update
      `;
      if (drawer[0]?.status === "closed") throw new ShopError("La caja de ese día ya se cerró; no se puede anular.");
      const already = await tx`select 1 from checkout_voids where checkout_id = ${checkoutId}::uuid`;
      if (already.length) throw new ShopError("Ese cobro ya estaba anulado.");
      const paid = await tx`select 1 from payout_items where checkout_id = ${checkoutId}::uuid`;
      if (paid.length) throw new ShopError("La comisión de ese cobro ya se le pagó al barbero; no se puede anular.");
      await tx`
        insert into checkout_voids (checkout_id, shop_id, reason, voided_by_member_id)
        values (${checkoutId}::uuid, ${ctx.shopId}::uuid, ${why}, ${ctx.memberId}::uuid)
      `;
      if (checkout.appointment_id) {
        await tx`
          update appointments set status = 'booked', closed_at = null
          where id = ${checkout.appointment_id}::uuid and shop_id = ${ctx.shopId}::uuid and status = 'done'
        `;
      }
    });
  } catch (error) {
    guard(error);
  }
}
