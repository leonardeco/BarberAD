import { withShop, type ShopTx } from "./db";
import { ShopError, messageFromDatabase } from "./errors";
import { commissionAmount, deriveMoney, wholePesos } from "./money";
import type { CheckoutReceipt, PaymentMethod, ShopContext } from "./types";

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
  const name = input.name.trim();
  if (!name) throw new ShopError("Escribe el nombre del servicio.");
  if (!Number.isInteger(input.durationMin) || input.durationMin < 1 || input.durationMin > 480) {
    throw new ShopError("La duración debe estar entre 1 y 480 minutos.");
  }
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

export type TodayCheckout = CheckoutReceipt & { barberName: string };

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
             m.display_name as "barberName"
      from checkouts c
      join shop_members m on m.id = c.member_id
      where c.shop_id = ${ctx.shopId}::uuid and c.business_date = ${day}::date
      order by c.completed_at desc
    `;
    const cash = checkouts
      .filter((row) => row.paymentMethod === "cash")
      .reduce((sum, row) => sum + row.charged + row.tip, 0);
    const commission = checkouts.reduce((sum, row) => sum + row.commissionAmount, 0);
    return {
      day,
      drawerStatus: drawer[0]?.status ?? "open",
      checkouts,
      expectedCash: cash,
      commission,
    };
  });
}

export async function visibleCheckoutIds(ctx: ShopContext) {
  return withShop(ctx, (tx) => tx<{ id: string }[]>`select id from checkouts`);
}

export async function closeDrawer(ctx: ShopContext, countedCash: number) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede cerrar la caja.");
  wholePesos(countedCash, "El efectivo contado");
  try {
    return await withShop(ctx, async (tx) => {
      const day = await businessDate(tx, ctx);
      const today = await listInside(tx, ctx, day);
      await tx`
        insert into cash_drawers (shop_id, business_date, status)
        values (${ctx.shopId}::uuid, ${day}::date, 'open')
        on conflict (shop_id, business_date) do nothing
      `;
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
