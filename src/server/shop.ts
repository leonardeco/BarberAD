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
  active: boolean;
};

export async function createService(
  ctx: ShopContext,
  input: { name: string; durationMin: number; listPrice: number },
) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede crear servicios.");
  const name = cleanName(input.name, "el nombre del servicio");
  checkDuration(input.durationMin);
  wholePesos(input.listPrice, "El precio");
  try {
    await withShop(ctx, (tx) => tx`
      insert into services (shop_id, name, duration_min, list_price)
      values (${ctx.shopId}::uuid, ${name}, ${input.durationMin}, ${input.listPrice})
    `);
  } catch (error) {
    guard(error);
  }
}

export async function updateService(
  ctx: ShopContext,
  serviceId: string,
  input: { name: string; durationMin: number; listPrice: number },
) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede editar servicios.");
  const name = cleanName(input.name, "el nombre del servicio");
  checkDuration(input.durationMin);
  wholePesos(input.listPrice, "El precio");
  const rows = await withShop(ctx, (tx) => tx`
    update services
    set name = ${name}, duration_min = ${input.durationMin}, list_price = ${input.listPrice}
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
    select id, name, duration_min, list_price, active
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

export type ShopProfile = { name: string; phone: string; address: string };

export async function shopProfile(ctx: ShopContext) {
  const rows = await withShop(ctx, (tx) => tx<ShopProfile[]>`
    select name, phone, address from shops where id = ${ctx.shopId}::uuid
  `);
  if (!rows[0]) throw new ShopError("No encontramos la barbería.");
  return rows[0];
}

export async function updateShopProfile(ctx: ShopContext, input: ShopProfile) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede editar la barbería.");
  const name = cleanName(input.name, "el nombre de la barbería");
  const phone = input.phone.trim();
  const address = input.address.trim();
  if (phone && !/^[0-9+\s()-]{7,20}$/.test(phone)) {
    throw new ShopError("Escribe un teléfono válido, solo números.");
  }
  if (address.length > 160) throw new ShopError("La dirección es demasiado larga.");
  await withShop(ctx, (tx) => tx`
    update shops set name = ${name}, phone = ${phone}, address = ${address}
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

      const services = await tx<{ name: string; list_price: number }[]>`
        select name, list_price
        from services
        where id = ${input.serviceId}::uuid and shop_id = ${ctx.shopId}::uuid and active
      `;
      const service = services[0];
      if (!service) throw new ShopError("Ese servicio no está disponible.");
      const money = deriveMoney(service.list_price, input.amount, input.reason);
      const commission = commissionAmount(money.charged, ctx.commissionPercent);
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
          currency, payment_method, commission_percent, commission_amount, client_key
        ) values (
          ${ctx.shopId}::uuid, ${ctx.memberId}::uuid, ${input.serviceId}::uuid,
          ${service.name}, ${day}::date, ${money.listPrice}, ${money.extras},
          ${money.discount}, ${money.discountReason}, ${money.charged}, ${input.tip},
          ${ctx.currency}, ${paymentMethod}, ${ctx.commissionPercent}, ${commission},
          ${input.clientKey}::uuid
        )
        returning id, service_name as "serviceName", charged, tip,
                  commission_amount as "commissionAmount",
                  payment_method as "paymentMethod"
      `;
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
      from checkouts c
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
    return {
      day,
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
    from checkouts
    where shop_id = ${ctx.shopId}::uuid and business_date = ${day}::date
  `;
  const expectedCash = checkouts
    .filter((row) => row.payment_method === "cash")
    .reduce((sum, row) => sum + row.charged + row.tip, 0);
  return { expectedCash };
}
