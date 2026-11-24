import { notFound, redirect } from "next/navigation";
import { Search } from "lucide-react";
import { PageTitle, Stat, cardClass, inputClass, quietButtonClass } from "@/components/ui";
import { adminOverview, adminShops, adminState } from "@/server/admin";
import { dayLabel } from "@/server/agenda";
import { formatCop } from "@/server/money";
import { getShopContext } from "@/server/session";
import { CourtesyShop, GrantPro } from "./courtesy";
import { OwnerCode } from "./owner-code";

export const metadata = { title: "Administrador" };

function pct(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 100)}%` : "—";
}

function Bars({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <p className="mb-2 text-sm text-[#CBD5E1]">{label}</p>
      <div aria-hidden="true" className="flex h-20 items-end gap-[3px]">
        {data.map((d) => (
          <div
            key={d.day}
            className="flex-1 rounded-t bg-[#D97706]/80"
            style={{ height: `${d.value ? Math.max(4, (d.value / max) * 100) : 2}%`, opacity: d.value ? 1 : 0.25 }}
            title={`${d.day}: ${d.value}`}
          />
        ))}
      </div>
      <p className="sr-only">{data.map((d) => `${d.day}: ${d.value}`).join(", ")}</p>
      <div className="mt-1 flex justify-between text-xs text-[#94A3B8]">
        <span>{dayLabel(data[0].day, "short")}</span>
        <span>{dayLabel(data.at(-1)!.day, "short")}</span>
      </div>
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const state = await adminState(ctx);
  if (state === "no") notFound();
  if (state === "needs-code") redirect("/admin/verificar");

  const q = String((await searchParams).q ?? "");
  const [o, shops] = await Promise.all([adminOverview(), adminShops(q)]);
  const finished = o.appointments.done30 + o.appointments.noShow30;
  const steps = [
    ["Se registraron", o.funnel.registered],
    ["Armaron su carta", o.funnel.withServices],
    ["Sumaron barberos", o.funnel.withTeam],
    ["Recibieron una reserva en línea", o.funnel.withBooking],
    ["Cobraron un corte", o.funnel.withCheckout],
  ] as const;

  return (
    <>
      <PageTitle title="Administrador" detail="Todas las barberías de BarberAD. Solo datos de uso: no ves clientes ni cobros individuales." />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Barberías" value={o.shops.total} detail={`+${o.shops.new7} esta semana · +${o.shops.new30} en 30 días`} />
        <Stat label="Activas (7 días)" value={o.shops.active7} detail={`${pct(o.shops.active7, o.shops.total)} del total · ${o.shops.active30} en 30 días`} />
        <Stat label="Cobrado en 30 días" value={formatCop(o.sales.last30.charged)} detail={`${o.sales.last30.cuts} cortes · hoy ${formatCop(o.sales.today.charged)}`} />
        <Stat label="Usuarios" value={o.users.total} detail={`${o.users.barbers} barberos · ${o.users.google} con Google`} />
        <Stat label="Plan Pro" value={o.shops.pro} detail={o.shops.proExpiring7 ? `${o.shops.proExpiring7} vencen esta semana` : `${pct(o.shops.pro, o.shops.total)} de las barberías`} />
        <Stat label="Ingresos (30 días)" value={formatCop(o.billing.revenue30)} detail={`${formatCop(o.billing.revenueTotal)} en total · ${o.billing.approved} pagos`} />
        <Stat label="Reservas en línea (30 días)" value={o.appointments.online30} detail={`${o.appointments.total30} citas en total`} />
        <Stat label="No vinieron (30 días)" value={pct(o.appointments.noShow30, finished)} detail={`${o.appointments.noShow30} de ${finished} citas · ${o.appointments.cancelledByClient30} canceladas por el cliente`} />
      </section>

      <section className={`${cardClass} mt-4 grid gap-6 p-5 lg:grid-cols-3`}>
        <Bars data={o.series.map((d) => ({ day: d.day, value: d.signups }))} label="Barberías nuevas por día" />
        <Bars data={o.series.map((d) => ({ day: d.day, value: d.cuts }))} label="Cortes por día" />
        <Bars data={o.series.map((d) => ({ day: d.day, value: d.bookings }))} label="Reservas en línea por día" />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Activación</h2>
        <p className="text-sm text-[#94A3B8]">Cuántas barberías llegan a cada paso. Donde más caen, ahí hay que ayudar.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {steps.map(([label, value]) => (
            <li key={label} className="grid grid-cols-[1fr_3rem] items-center gap-3 text-sm">
              <div>
                <div className="flex justify-between">
                  <span>{label}</span>
                  <span className="tabular-nums text-[#94A3B8]">{pct(value, o.funnel.registered)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#1E293B]">
                  <div className="h-full rounded-full bg-[#D97706]" style={{ width: pct(value, o.funnel.registered) === "—" ? "0%" : `${(value / o.funnel.registered) * 100}%` }} />
                </div>
              </div>
              <span className="text-right font-semibold tabular-nums">{value}</span>
            </li>
          ))}
        </ul>
      </section>

      <CourtesyShop />

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Barberías</h2>
        <form className="mt-3 flex gap-2" role="search">
          <input aria-label="Buscar barbería o dueño" className={inputClass} defaultValue={q} name="q" placeholder="Nombre, enlace o correo del dueño" />
          <button aria-label="Buscar" className={`${quietButtonClass} w-12 shrink-0 px-0`} type="submit">
            <Search aria-hidden="true" size={18} />
          </button>
        </form>
        {shops.length === 0 ? (
          <p className="mt-3 text-sm text-[#94A3B8]">No hay barberías con ese dato.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {shops.map((shop) => (
              <li key={shop.shopId} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{shop.name}</p>
                    <p className="truncate text-sm text-[#CBD5E1]">
                      {shop.ownerName} · {shop.ownerEmail}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      shop.pro ? "bg-[#D97706]/20 text-[#FBBF24]" : "bg-white/10 text-[#CBD5E1]"
                    }`}
                  >
                    {shop.pro ? `Pro hasta ${shop.planUntil}` : "Gratis"}{shop.grants ? " · cortesía" : ""}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#94A3B8]">
                  Desde {shop.createdAt} · {shop.barbers === 1 ? "1 barbero" : `${shop.barbers} barberos`} ·{" "}
                  {shop.lastActivity ? `último cobro ${shop.lastActivity}` : "sin cobros todavía"}
                </p>
                <p className="text-sm text-[#CBD5E1]">
                  30 días: {shop.cuts30} cortes · {formatCop(shop.charged30)} · {shop.online30} reservas en línea
                </p>
                <details className="group mt-2 border-t border-white/5 pt-1">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center text-sm text-[#D97706]">
                    <span className="group-open:hidden">Soporte</span>
                    <span className="hidden group-open:inline">Cerrar</span>
                  </summary>
                  <div className="flex flex-col gap-2 pb-1">
                    {shop.phone ? (
                      <a className={`${quietButtonClass} h-10 text-xs`} href={`https://wa.me/${shop.phone.replace(/\D/g, "")}`} rel="noreferrer" target="_blank">
                        Escribirle por WhatsApp
                      </a>
                    ) : null}
                    <GrantPro shopId={shop.shopId} />
                    {shop.grants ? (
                      <p className="text-xs text-[#94A3B8]">
                        Ya le regalaste {shop.grantedMonths === 1 ? "1 mes" : `${shop.grantedMonths} meses`} en {shop.grants === 1 ? "1 vez" : `${shop.grants} veces`}.
                      </p>
                    ) : null}
                    <OwnerCode shopId={shop.shopId} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
