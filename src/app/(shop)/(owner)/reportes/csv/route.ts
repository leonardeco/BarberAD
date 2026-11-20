import { withShop } from "@/server/db";
import { isDay } from "@/server/agenda";
import { getShopContext } from "@/server/session";

const methods: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta" };

function cell(value: string | number) {
  const text = String(value);
  // Evita que Excel ejecute fórmulas escritas en un motivo de descuento o un nombre.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: Request) {
  const ctx = await getShopContext();
  if (!ctx || ctx.role !== "owner") return new Response("No autorizado", { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get("desde") ?? "";
  const to = url.searchParams.get("hasta") ?? "";
  if (!isDay(from) || !isDay(to) || from > to) return new Response("Fechas no válidas", { status: 400 });

  const rows = await withShop(ctx, (tx) => tx<{
    day: string; time: string; barber: string; role: string; service: string; list_price: number; discount: number;
    reason: string; charged: number; tip: number; method: string; pct: number; commission: number;
  }[]>`
    select c.business_date::text as day, to_char(c.completed_at at time zone s.timezone, 'HH24:MI') as time,
           m.display_name as barber, m.role, c.service_name as service, c.list_price, c.discount,
           c.discount_reason as reason, c.charged, c.tip, c.payment_method as method,
           c.commission_percent as pct, c.commission_amount as commission
    from live_checkouts c
    join shop_members m on m.id = c.member_id
    join shops s on s.id = c.shop_id
    where c.shop_id = ${ctx.shopId}::uuid and c.business_date between ${from}::date and ${to}::date
    order by c.completed_at
  `);
  const header = ["Fecha", "Hora", "Barbero", "Servicio", "Precio de lista", "Descuento", "Motivo", "Cobrado", "Propina", "Método", "Comisión %", "Comisión", "Para la barbería"];
  const lines = rows.map((r) => {
    const commission = r.role === "owner" ? 0 : r.commission;
    return [r.day, r.time, r.barber, r.service, r.list_price, r.discount, r.reason, r.charged, r.tip, methods[r.method] ?? r.method,
      r.role === "owner" ? "" : r.pct, commission, r.charged - commission].map(cell).join(";");
  });
  // Punto y coma y BOM: así lo abre bien Excel en español.
  const body = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="barberad-${from}-a-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
