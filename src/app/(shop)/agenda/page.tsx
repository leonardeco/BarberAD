import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarX, ChevronLeft, ChevronRight, MessageCircle, Plus } from "lucide-react";
import { RefreshToday } from "@/components/refresh-today";
import { EmptyState, PageTitle, buttonClass, cardClass, quietButtonClass } from "@/components/ui";
import { addDays, dayAgenda, dayLabel, isDay, shopToday, timeLabel, type AgendaAppointment } from "@/server/agenda";
import { formatCop } from "@/server/money";
import { getShopContext } from "@/server/session";
import { listServices } from "@/server/shop";
import { cancelAppointmentAction } from "./actions";
import { NewAppointment } from "./new-appointment";

export const metadata = { title: "Agenda" };

const statusLabel: Record<AgendaAppointment["status"], { text: string; className: string }> = {
  booked: { text: "Reservada", className: "bg-[#1D4ED8]/30 text-[#BFDBFE]" },
  done: { text: "Atendida", className: "bg-[#14532D]/50 text-[#BBF7D0]" },
  cancelled: { text: "Cancelada", className: "bg-white/10 text-[#94A3B8]" },
  no_show: { text: "No vino", className: "bg-[#7F1D1D]/50 text-[#FECACA]" },
};

function hm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const requested = (await searchParams).dia;
  const day = requested && isDay(requested) ? requested : await shopToday(ctx);
  const [agenda, services] = await Promise.all([dayAgenda(ctx, day), listServices(ctx, true)]);
  const active = agenda.appointments.filter((item) => item.status !== "cancelled");
  const expected = active.filter((item) => item.status === "booked").reduce((sum, item) => sum + item.listPrice, 0);

  return (
    <>
      {day === agenda.today ? <RefreshToday /> : null}
      <PageTitle
        title="Agenda"
        detail={`${dayLabel(day)} · ${active.length === 1 ? "1 cita" : `${active.length} citas`}${expected ? ` · ${formatCop(expected)} por cobrar` : ""}`}
      />

      <nav aria-label="Cambiar de día" className="mb-6 flex items-center gap-2">
        <Link aria-label="Día anterior" className={`${quietButtonClass} w-12 px-0`} href={`/agenda?dia=${addDays(day, -1)}`}>
          <ChevronLeft aria-hidden="true" size={20} />
        </Link>
        <Link className={`${quietButtonClass} flex-1`} href="/agenda">
          {day === agenda.today ? "Hoy" : "Volver a hoy"}
        </Link>
        <Link aria-label="Día siguiente" className={`${quietButtonClass} w-12 px-0`} href={`/agenda?dia=${addDays(day, 1)}`}>
          <ChevronRight aria-hidden="true" size={20} />
        </Link>
      </nav>

      {agenda.members.length === 0 ? (
        <EmptyState
          icon={<CalendarX aria-hidden="true" size={22} strokeWidth={1.75} />}
          title="Nadie recibe citas todavía"
          detail={ctx.role === "owner" ? "Activa la agenda de tu equipo en Horarios." : "Pídele al dueño que active tu agenda."}
        >
          {ctx.role === "owner" ? (
            <Link className={buttonClass} href="/horarios">
              Ir a horarios
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {agenda.members.map((member) => {
            const items = agenda.appointments.filter((item) => item.memberId === member.id);
            return (
              <section key={member.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">{member.name}</h2>
                  <p className="text-sm text-[#94A3B8]">
                    {member.hours.length ? member.hours.map((h) => `${hm(h.start)}–${hm(h.end)}`).join(", ") : "No trabaja este día"}
                  </p>
                </div>
                {items.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-[#94A3B8]">Sin citas.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map((item) => {
                      const status = statusLabel[item.status];
                      return (
                        <li
                          key={item.id}
                          className={`${cardClass} flex items-start gap-3 p-4 ${item.status === "cancelled" ? "opacity-50" : ""}`}
                        >
                          <p className="w-14 shrink-0 pt-0.5 font-semibold tabular-nums">{timeLabel(item.startsAt, ctx.timezone)}</p>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate font-medium">{item.clientName}</p>
                              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.text}</span>
                            </div>
                            <p className="text-sm text-[#CBD5E1]">
                              {item.serviceName} · hasta {timeLabel(item.endsAt, ctx.timezone)}
                              {item.source === "public" ? " · reservó en línea" : ""}
                            </p>
                            {item.status === "booked" ? (
                              <div className="mt-2 flex gap-2">
                                <a
                                  className={`${quietButtonClass} h-10 flex-1`}
                                  href={`https://wa.me/${item.clientPhone}`}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <MessageCircle aria-hidden="true" size={16} /> WhatsApp
                                </a>
                                <form action={cancelAppointmentAction} className="flex-1">
                                  <input name="appointmentId" type="hidden" value={item.id} />
                                  <button className={`${quietButtonClass} h-10 w-full`} type="submit">
                                    Cancelar
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {agenda.members.length > 0 && services.length > 0 ? (
        <NewAppointment
          day={day}
          defaultMemberId={agenda.members.some((m) => m.id === ctx.memberId) ? ctx.memberId : agenda.members[0].id}
          members={agenda.members.map((m) => ({ id: m.id, name: m.name }))}
          services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.duration_min }))}
        />
      ) : null}
      {services.length === 0 && ctx.role === "owner" ? (
        <p className="mt-6 text-sm text-[#94A3B8]">
          <Plus aria-hidden="true" className="inline" size={14} /> Para agendar, primero <Link className="text-[#D97706]" href="/servicios">arma tu carta</Link>.
        </p>
      ) : null}
    </>
  );
}
