import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight, Banknote, CreditCard, Plus, Scissors } from "lucide-react";
import { Guide } from "@/components/guide";
import { RefreshToday } from "@/components/refresh-today";
import { EmptyState, PageTitle, Stat, buttonClass, cardClass } from "@/components/ui";
import { formatCop } from "@/server/money";
import { getShopContext } from "@/server/session";
import { guideStatus, listToday } from "@/server/shop";
import { dayAgenda, timeLabel } from "@/server/agenda";

export const metadata = { title: "Hoy" };

const methods = {
  cash: { label: "Efectivo", icon: Banknote },
  transfer: { label: "Transferencia", icon: ArrowLeftRight },
  card: { label: "Tarjeta", icon: CreditCard },
} as const;

function longDay(day: string) {
  const text = new Date(`${day}T12:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function TodayPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const [today, guide] = await Promise.all([listToday(ctx), guideStatus(ctx)]);
  const agenda = await dayAgenda(ctx, today.day);
  const pending = agenda.appointments.filter((item) => item.status === "booked");
  const attended = agenda.appointments.filter((item) => item.status === "done").length;
  const noShows = agenda.appointments.filter((item) => item.status === "no_show").length;
  const owner = ctx.role === "owner";
  const cuts = today.checkouts.length;
  const top = today.barbers[0]?.charged ?? 0;

  return (
    <>
      <RefreshToday />
      <PageTitle
        title="Hoy"
        detail={`${longDay(today.day)} · ${today.drawerStatus === "closed" ? "caja cerrada" : "caja abierta"}`}
        action={
          <div className="hidden shrink-0 lg:block">
            <Link className={`${buttonClass.replace("w-full", "w-auto")} px-6`} href="/cobrar">
              <Plus aria-hidden="true" size={18} strokeWidth={2.25} />
              Cobrar
            </Link>
          </div>
        }
      />

      {guide && !guide.hidden ? <Guide done={guide.done} steps={guide.steps} /> : null}

      <section className={`${cardClass} relative overflow-hidden p-5`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-10"
          style={{ background: "repeating-linear-gradient(135deg, #D97706 0 12px, transparent 12px 24px)" }}
        />
        <p className="text-sm text-[#CBD5E1]">{owner ? "Cobrado hoy" : "Tu comisión hoy"}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
          {formatCop(owner ? today.charged : today.commission)}
        </p>
        <p className="mt-1 text-sm text-[#CBD5E1]">
          {cuts === 1 ? "1 corte" : `${cuts} cortes`} · propinas {formatCop(today.tips)}
        </p>
        {owner ? (
          <dl className="mt-5 grid grid-cols-3 gap-2">
            {(Object.keys(methods) as (keyof typeof methods)[]).map((key) => {
              const Icon = methods[key].icon;
              return (
                <div key={key} className="rounded-xl bg-[#0F172A]/60 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                    <Icon aria-hidden="true" size={14} strokeWidth={1.75} />
                    {methods[key].label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums">{formatCop(today.byMethod[key])}</dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {owner ? (
          <>
            <Stat label="Ticket promedio" value={formatCop(today.averageTicket)} />
            <Stat label="Comisiones" value={formatCop(today.commission)} detail="Lo que se le debe al equipo" />
            <Stat label="Efectivo en caja" value={formatCop(today.expectedCash)} detail="Cobros y propinas en efectivo" />
            <Stat
              label="Descuentos"
              value={today.discounts}
              detail={today.discounts ? "Revisa el motivo abajo" : "Ninguno hoy"}
            />
          </>
        ) : (
          <>
            <Stat label="Cortes" value={cuts} />
            <Stat label="Propinas" value={formatCop(today.tips)} />
          </>
        )}
      </section>

      {agenda.appointments.length > 0 ? (
        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Citas de hoy</h2>
            <Link className="text-sm text-[#D97706]" href="/agenda">
              Ver agenda
            </Link>
          </div>
          <p className="mt-1 text-sm text-[#CBD5E1]">
            {pending.length} por atender · {attended} atendidas{noShows ? ` · ${noShows} no vinieron` : ""}
          </p>
          {pending.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {pending.slice(0, 4).map((item) => (
                <li key={item.id} className={`${cardClass} flex items-center gap-3 p-3`}>
                  <span className="w-12 shrink-0 font-semibold tabular-nums">{timeLabel(item.startsAt, ctx.timezone)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.clientName}</span>
                    <span className="block truncate text-sm text-[#94A3B8]">
                      {item.serviceName}
                      {owner ? ` · ${item.memberName}` : ""}
                      {item.started ? " · en silla" : ""}
                    </span>
                  </span>
                  <Link className={`${buttonClass.replace("w-full", "w-auto")} h-10 shrink-0 px-4 text-sm`} href={`/cobrar?cita=${item.id}`}>
                    Cobrar
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {owner && today.barbers.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Por barbero</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {today.barbers.map((barber) => (
              <li key={barber.memberId} className={`${cardClass} p-4`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{barber.name}</p>
                  <p className="font-semibold tabular-nums">{formatCop(barber.charged)}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0F172A]">
                  <div
                    className="h-full rounded-full bg-[#D97706]"
                    style={{ width: `${top ? Math.max(4, Math.round((barber.charged / top) * 100)) : 0}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-[#CBD5E1]">
                  {barber.cuts === 1 ? "1 corte" : `${barber.cuts} cortes`}
                  {barber.isOwner ? "" : ` · comisión ${formatCop(barber.commission)}`}
                  {barber.tips ? ` · propinas ${formatCop(barber.tips)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Cortes del día</h2>
        {cuts === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<Scissors aria-hidden="true" size={22} strokeWidth={1.75} />}
              title="Hoy todavía no hay cortes"
              detail="Cuando cobres el primero, aparece aquí con su comisión."
            >
              <Link className={buttonClass} href="/cobrar">
                Cobrar un corte
              </Link>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {today.checkouts.map((cut) => {
              const Icon = methods[cut.paymentMethod].icon;
              return (
                <li key={cut.id} className={`${cardClass} flex items-start gap-3 p-4`}>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-[#CBD5E1]">
                    <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">{cut.serviceName}</p>
                      <p className="font-semibold tabular-nums">{formatCop(cut.charged)}</p>
                    </div>
                    <p className="text-sm text-[#CBD5E1]">
                      {cut.time} · {owner ? `${cut.barberName} · ` : ""}
                      {methods[cut.paymentMethod].label}
                      {cut.tip > 0 ? ` · propina ${formatCop(cut.tip)}` : ""}
                    </p>
                    {cut.discount > 0 ? (
                      <p className="mt-1 text-sm text-[#FBBF24]">
                        Descuento de {formatCop(cut.discount)} sobre {formatCop(cut.listPrice)}: {cut.discountReason}
                      </p>
                    ) : null}
                    {cut.isOwner ? null : (
                      <p className="mt-1 text-xs text-[#94A3B8]">Comisión {formatCop(cut.commissionAmount)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
