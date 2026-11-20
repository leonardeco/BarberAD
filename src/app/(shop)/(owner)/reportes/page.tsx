import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { PageTitle, Stat, buttonClass, cardClass, inputClass, quietButtonClass } from "@/components/ui";
import { dayLabel, shopToday } from "@/server/agenda";
import { formatCop } from "@/server/money";
import { periodLabels, resolvePeriod } from "@/server/periods";
import { shopReport } from "@/server/reports";
import { getShopContext } from "@/server/session";

export const metadata = { title: "Reportes" };

type Params = { p?: string; desde?: string; hasta?: string };

function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? null : null;
  return Math.round(((current - previous) / previous) * 100);
}

function Change({ current, previous, label }: { current: number; previous: number; label: string }) {
  const pct = delta(current, previous);
  if (pct === null) return <span className="text-[#94A3B8]">Sin datos del {label} para comparar</span>;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 ${up ? "text-[#BBF7D0]" : "text-[#FECACA]"}`}>
      <Icon aria-hidden="true" size={14} />
      {up ? "+" : ""}
      {pct}% frente al {label}
    </span>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const params = await searchParams;
  const today = await shopToday(ctx);
  const period = resolvePeriod(today, params);
  const report = await shopReport(ctx, period.from, period.to);
  const { totals, previous } = report;
  const compareLabel = report.days === 1 ? "día anterior" : "período anterior";
  const maxDay = Math.max(1, ...report.byDay.map((d) => d.charged));
  const query = `desde=${period.from}&hasta=${period.to}`;
  const range = period.from === period.to ? dayLabel(period.from) : `${dayLabel(period.from, "short")} al ${dayLabel(period.to, "short").toLowerCase()}`;

  return (
    <>
      <PageTitle
        title="Reportes"
        detail={range}
        action={
          <a className={`${quietButtonClass} shrink-0`} href={`/reportes/csv?${query}`}>
            <Download aria-hidden="true" size={16} /> Excel
          </a>
        }
      />

      <nav aria-label="Período" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {periodLabels.map((item) => (
          <Link
            key={item.key}
            aria-current={period.key === item.key ? "page" : undefined}
            className={`inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm ${
              period.key === item.key ? "border-[#D97706] bg-[#D97706] font-semibold text-[#0F172A]" : "border-white/10 text-[#CBD5E1]"
            }`}
            href={`/reportes?p=${item.key}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <details className={`${cardClass} mb-6 px-4 py-1`} open={period.key === "rango"}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm text-[#D97706]">Elegir fechas</summary>
        <form className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 pb-3">
          <input name="p" type="hidden" value="rango" />
          <label className="text-xs text-[#94A3B8]">
            Desde
            <input className={`${inputClass} mt-1 px-2`} defaultValue={period.from} max={today} name="desde" type="date" />
          </label>
          <label className="text-xs text-[#94A3B8]">
            Hasta
            <input className={`${inputClass} mt-1 px-2`} defaultValue={period.to} max={today} name="hasta" type="date" />
          </label>
          <button className={`${buttonClass} w-auto px-4`} type="submit">
            Ver
          </button>
        </form>
      </details>

      <section className={`${cardClass} relative overflow-hidden p-5`}>
        <p className="text-sm text-[#CBD5E1]">Le queda a la barbería</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatCop(totals.shopProfit)}</p>
        <p className="mt-1 text-sm">
          <Change current={totals.shopProfit} label={compareLabel} previous={previous.shopProfit} />
        </p>
        <p className="mt-3 text-sm text-[#94A3B8]">
          Cobrado {formatCop(totals.charged)} − comisiones del equipo {formatCop(totals.teamCommission)}. Las propinas son de los barberos y no entran aquí.
        </p>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cortes" value={totals.cuts} detail={<Change current={totals.cuts} label={compareLabel} previous={previous.cuts} />} />
        <Stat label="Cobrado" value={formatCop(totals.charged)} detail={`Ticket promedio ${formatCop(totals.averageTicket)}`} />
        <Stat label="Comisiones del equipo" value={formatCop(totals.teamCommission)} detail="Lo que se le debe a los barberos" />
        <Stat label="Propinas" value={formatCop(totals.tips)} detail={totals.discounts ? `${totals.discounts} cobros con descuento` : "Sin descuentos"} />
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2">
        {(["cash", "transfer", "card"] as const).map((key) => (
          <div key={key} className="rounded-xl bg-[#1E293B] px-3 py-2">
            <p className="text-xs text-[#94A3B8]">{{ cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta" }[key]}</p>
            <p className="text-sm font-semibold tabular-nums">{formatCop(report.byMethod[key])}</p>
          </div>
        ))}
      </section>

      {report.days > 1 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Día a día</h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {report.byDay.map((day) => (
              <li key={day.day} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3 text-sm">
                <span className="text-[#CBD5E1]">{dayLabel(day.day, "short")}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[#1E293B]">
                  <span className="block h-full rounded-full bg-[#D97706]" style={{ width: `${(day.charged / maxDay) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{day.cuts ? formatCop(day.charged) : "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Por barbero</h2>
          <Link className="text-sm text-[#D97706]" href="/liquidar">
            Liquidar comisiones
          </Link>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {report.byBarber.map((line) => {
            const occupancy = line.availableMinutes ? Math.min(100, Math.round((line.bookedMinutes / line.availableMinutes) * 100)) : null;
            return (
              <li key={line.memberId} className={`${cardClass} p-4`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">
                    {line.name}
                    {line.isOwner ? <span className="ml-2 text-xs text-[#94A3B8]">dueño</span> : null}
                  </p>
                  <p className="font-semibold tabular-nums">{formatCop(line.charged)}</p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Cortes</dt>
                    <dd className="tabular-nums">{line.cuts}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#94A3B8]">{line.isOwner ? "Comisión" : "Su comisión"}</dt>
                    <dd className="tabular-nums">{line.isOwner ? "—" : formatCop(line.commission)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Para la barbería</dt>
                    <dd className="tabular-nums text-[#FBBF24]">{formatCop(line.shopShare)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Agenda ocupada</dt>
                    <dd className="tabular-nums">{occupancy === null ? "—" : `${occupancy}%`}</dd>
                  </div>
                </dl>
                {line.tips ? <p className="mt-2 text-xs text-[#94A3B8]">Propinas {formatCop(line.tips)}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold">Por servicio</h2>
          {report.byService.length === 0 ? (
            <p className="mt-2 text-sm text-[#94A3B8]">Sin cobros en este período.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {report.byService.map((row) => (
                <li key={row.name} className={`${cardClass} flex items-center justify-between gap-3 px-4 py-3 text-sm`}>
                  <span>
                    {row.name} <span className="text-[#94A3B8]">· {row.cuts}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatCop(row.charged)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="text-lg font-semibold">Citas</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["Atendidas", report.appointments.done],
              ["No vinieron", report.appointments.noShow],
              ["Canceladas", report.appointments.cancelled],
              ["Por atender", report.appointments.pending],
            ].map(([label, value]) => (
              <div key={label} className={`${cardClass} px-4 py-3`}>
                <dt className="text-xs text-[#94A3B8]">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm text-[#94A3B8]">{report.appointments.online} reservadas desde tu enlace.</p>
        </section>
      </div>
    </>
  );
}
