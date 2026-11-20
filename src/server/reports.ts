import { withShop } from "./db";
import { ShopError, messageFromDatabase } from "./errors";
import type { ShopContext } from "./types";
import { addDays, isDay, isUuid } from "./agenda";

function ownerOnly(ctx: ShopContext) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede ver las ganancias.");
}

export type Totals = {
  cuts: number;
  charged: number;
  tips: number;
  teamCommission: number;
  shopProfit: number;
  averageTicket: number;
  discounts: number;
};

export type BarberLine = {
  memberId: string;
  name: string;
  isOwner: boolean;
  cuts: number;
  charged: number;
  commission: number;
  tips: number;
  shopShare: number;
  bookedMinutes: number;
  availableMinutes: number;
};

export type Report = {
  from: string;
  to: string;
  days: number;
  totals: Totals;
  previous: Totals;
  byMethod: { cash: number; transfer: number; card: number };
  byBarber: BarberLine[];
  byService: { name: string; cuts: number; charged: number }[];
  byDay: { day: string; cuts: number; charged: number; shopProfit: number }[];
  appointments: { done: number; noShow: number; cancelled: number; pending: number; online: number };
};

type TotalsRow = { cuts: number; charged: number; tips: number; team: number; discounts: number };

function toTotals(row: TotalsRow | undefined): Totals {
  const cuts = row?.cuts ?? 0;
  const charged = row?.charged ?? 0;
  const team = row?.team ?? 0;
  return {
    cuts,
    charged,
    tips: row?.tips ?? 0,
    teamCommission: team,
    shopProfit: charged - team,
    averageTicket: cuts ? Math.round(charged / cuts) : 0,
    discounts: row?.discounts ?? 0,
  };
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

// Rangos por día de caja (business_date), en la hora de la barbería. Ambos extremos incluidos.
export async function shopReport(ctx: ShopContext, from: string, to: string): Promise<Report> {
  ownerOnly(ctx);
  if (!isDay(from) || !isDay(to) || from > to) throw new ShopError("Elige un rango de fechas válido.");
  const days = daysBetween(from, to);
  if (days > 366) throw new ShopError("El rango no puede pasar de un año.");
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -days);

  return withShop(ctx, async (tx) => {
    const totalsQuery = (a: string, b: string) => tx<TotalsRow[]>`
      select count(*)::int as cuts,
             coalesce(sum(c.charged), 0)::int as charged,
             coalesce(sum(c.tip), 0)::int as tips,
             coalesce(sum(c.commission_amount) filter (where m.role = 'barber'), 0)::int as team,
             count(*) filter (where c.discount > 0)::int as discounts
      from checkouts c
      join shop_members m on m.id = c.member_id
      where c.shop_id = ${ctx.shopId}::uuid and c.business_date between ${a}::date and ${b}::date
    `;
    const [current, previous] = await Promise.all([totalsQuery(from, to), totalsQuery(prevFrom, prevTo)]);

    const methods = await tx<{ method: "cash" | "transfer" | "card"; total: number }[]>`
      select payment_method as method, coalesce(sum(charged + tip), 0)::int as total
      from checkouts
      where shop_id = ${ctx.shopId}::uuid and business_date between ${from}::date and ${to}::date
      group by payment_method
    `;
    const byMethod = { cash: 0, transfer: 0, card: 0 };
    for (const row of methods) byMethod[row.method] = row.total;

    const barbers = await tx<(Omit<BarberLine, "shopShare">)[]>`
      with range as (
        select d::date as day from generate_series(${from}::date, ${to}::date, interval '1 day') d
      ), sales as (
        select c.member_id, count(*)::int as cuts, sum(c.charged)::int as charged,
               sum(c.commission_amount)::int as commission, sum(c.tip)::int as tips
        from checkouts c
        where c.shop_id = ${ctx.shopId}::uuid and c.business_date between ${from}::date and ${to}::date
        group by c.member_id
      ), available as (
        select h.member_id, sum(h.end_min - h.start_min)::int as minutes
        from member_hours h join range r on extract(isodow from r.day)::int = h.weekday
        where h.shop_id = ${ctx.shopId}::uuid
        group by h.member_id
      ), booked as (
        select a.member_id, sum(extract(epoch from a.ends_at - a.starts_at) / 60)::int as minutes
        from appointments a join shops s on s.id = a.shop_id
        where a.shop_id = ${ctx.shopId}::uuid and a.status in ('booked', 'done')
          and (a.starts_at at time zone s.timezone)::date between ${from}::date and ${to}::date
        group by a.member_id
      )
      select m.id as "memberId", m.display_name as name, (m.role = 'owner') as "isOwner",
             coalesce(s.cuts, 0) as cuts, coalesce(s.charged, 0) as charged,
             case when m.role = 'owner' then 0 else coalesce(s.commission, 0) end as commission,
             coalesce(s.tips, 0) as tips,
             coalesce(b.minutes, 0) as "bookedMinutes",
             case when m.takes_appointments then coalesce(v.minutes, 0) else 0 end as "availableMinutes"
      from shop_members m
      left join sales s on s.member_id = m.id
      left join available v on v.member_id = m.id
      left join booked b on b.member_id = m.id
      where m.shop_id = ${ctx.shopId}::uuid and (m.active or s.cuts is not null)
      order by coalesce(s.charged, 0) desc, m.display_name
    `;

    const byService = await tx<{ name: string; cuts: number; charged: number }[]>`
      select service_name as name, count(*)::int as cuts, sum(charged)::int as charged
      from checkouts
      where shop_id = ${ctx.shopId}::uuid and business_date between ${from}::date and ${to}::date
      group by service_name
      order by sum(charged) desc, service_name
    `;

    const byDay = await tx<{ day: string; cuts: number; charged: number; team: number }[]>`
      select d::date::text as day,
             count(c.id)::int as cuts,
             coalesce(sum(c.charged), 0)::int as charged,
             coalesce(sum(c.commission_amount) filter (where m.role = 'barber'), 0)::int as team
      from generate_series(${from}::date, ${to}::date, interval '1 day') d
      left join checkouts c on c.shop_id = ${ctx.shopId}::uuid and c.business_date = d::date
      left join shop_members m on m.id = c.member_id
      group by d
      order by d
    `;

    const appts = await tx<{ status: string; online: number; total: number }[]>`
      select a.status, count(*) filter (where a.source = 'public')::int as online, count(*)::int as total
      from appointments a join shops s on s.id = a.shop_id
      where a.shop_id = ${ctx.shopId}::uuid
        and (a.starts_at at time zone s.timezone)::date between ${from}::date and ${to}::date
      group by a.status
    `;
    const count = (status: string) => appts.find((row) => row.status === status)?.total ?? 0;

    return {
      from,
      to,
      days,
      totals: toTotals(current[0]),
      previous: toTotals(previous[0]),
      byMethod,
      byBarber: barbers.map((row) => ({ ...row, shopShare: row.charged - row.commission })),
      byService,
      byDay: byDay.map((row) => ({ day: row.day, cuts: row.cuts, charged: row.charged, shopProfit: row.charged - row.team })),
      appointments: {
        done: count("done"),
        noShow: count("no_show"),
        cancelled: count("cancelled"),
        pending: count("booked"),
        online: appts.reduce((sum, row) => sum + row.online, 0),
      },
    };
  });
}

// ---------- Liquidación de comisiones ----------

export type PendingPayout = {
  memberId: string;
  name: string;
  cuts: number;
  commission: number;
  tips: number;
  from: string | null;
  to: string | null;
};

export type PayoutRow = {
  id: string;
  memberName: string;
  cuts: number;
  commission: number;
  tips: number;
  from: string | null;
  to: string | null;
  paidAt: string;
};

export async function pendingPayouts(ctx: ShopContext) {
  ownerOnly(ctx);
  return withShop(ctx, (tx) => tx<PendingPayout[]>`
    select m.id as "memberId", m.display_name as name,
           count(c.id)::int as cuts,
           coalesce(sum(c.commission_amount), 0)::int as commission,
           coalesce(sum(c.tip), 0)::int as tips,
           min(c.business_date)::text as "from",
           max(c.business_date)::text as "to"
    from shop_members m
    left join checkouts c on c.member_id = m.id
      and not exists (select 1 from payout_items p where p.checkout_id = c.id)
    where m.shop_id = ${ctx.shopId}::uuid and m.role = 'barber'
    group by m.id
    having m.active or count(c.id) > 0
    order by coalesce(sum(c.commission_amount), 0) desc, m.display_name
  `);
}

export async function payoutHistory(ctx: ShopContext, memberId?: string) {
  return withShop(ctx, (tx) => tx<PayoutRow[]>`
    select p.id, m.display_name as "memberName", p.cuts, p.commission, p.tips,
           p.covers_from::text as "from", p.covers_until::text as "to",
           to_char(p.created_at at time zone s.timezone, 'YYYY-MM-DD HH24:MI') as "paidAt"
    from payouts p
    join shop_members m on m.id = p.member_id
    join shops s on s.id = p.shop_id
    where p.shop_id = ${ctx.shopId}::uuid
      and (${memberId ?? null}::uuid is null or p.member_id = ${memberId ?? null}::uuid)
    order by p.created_at desc
    limit 20
  `);
}

// Paga todo lo pendiente de un barbero: sus comisiones y sus propinas, que la barbería recibió en la caja.
export async function payBarber(ctx: ShopContext, memberId: string) {
  ownerOnly(ctx);
  if (!isUuid(memberId)) throw new ShopError("Ese barbero no existe.");
  try {
    return await withShop(ctx, async (tx) => {
      const members = await tx<{ id: string }[]>`
        select id from shop_members
        where id = ${memberId}::uuid and shop_id = ${ctx.shopId}::uuid and role = 'barber'
        for update
      `;
      if (!members[0]) throw new ShopError("Ese barbero no existe.");
      const rows = await tx<{ id: string; business_date: string; commission_amount: number; tip: number }[]>`
        select c.id, c.business_date::text as business_date, c.commission_amount, c.tip
        from checkouts c
        where c.member_id = ${memberId}::uuid and c.shop_id = ${ctx.shopId}::uuid
          and not exists (select 1 from payout_items p where p.checkout_id = c.id)
        order by c.completed_at
      `;
      if (rows.length === 0) throw new ShopError("No tiene nada pendiente por pagar.");
      const commission = rows.reduce((sum, row) => sum + row.commission_amount, 0);
      const tips = rows.reduce((sum, row) => sum + row.tip, 0);
      const days = rows.map((row) => row.business_date).sort();
      const [payout] = await tx<{ id: string }[]>`
        insert into payouts (shop_id, member_id, covers_from, covers_until, cuts, commission, tips, paid_by_member_id)
        values (${ctx.shopId}::uuid, ${memberId}::uuid, ${days[0]}::date, ${days.at(-1)!}::date,
                ${rows.length}, ${commission}, ${tips}, ${ctx.memberId}::uuid)
        returning id
      `;
      await tx`
        insert into payout_items (payout_id, checkout_id, shop_id)
        select ${payout.id}::uuid, unnest(${tx.array(rows.map((row) => row.id))}::uuid[]), ${ctx.shopId}::uuid
      `;
      return { id: payout.id, cuts: rows.length, commission, tips, total: commission + tips };
    });
  } catch (error) {
    if (error instanceof ShopError) throw error;
    const message = messageFromDatabase(error);
    if (message) throw new ShopError(message.includes("ya existe") ? "Ese pago ya se registró." : message);
    throw error;
  }
}
