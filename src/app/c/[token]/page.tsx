import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, CalendarX, MapPin } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonClass, cardClass, quietButtonClass } from "@/components/ui";
import { clientAppointment } from "@/server/reminders";
import { cancelMineAction } from "./actions";

export const metadata = { title: "Tu cita", robots: { index: false } };

export default async function ClientAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appointment = await clientAppointment(token);
  if (!appointment) notFound();
  const when = new Date(appointment.startsAt).toLocaleString("es-CO", {
    timeZone: appointment.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  const cancelled = appointment.status === "cancelled";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-10">
      <Logo size={32} />
      <section className={`${cardClass} p-6 text-center`}>
        <span
          className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full ${
            cancelled ? "bg-white/10 text-[#CBD5E1]" : "bg-[#14532D] text-[#BBF7D0]"
          }`}
        >
          {cancelled ? <CalendarX aria-hidden="true" size={28} /> : <CalendarCheck aria-hidden="true" size={28} />}
        </span>
        <h1 className="mt-4 text-xl font-semibold">
          {cancelled
            ? "Esta cita está cancelada"
            : appointment.status === "done"
              ? "¡Gracias por venir!"
              : appointment.status === "no_show"
                ? "Esta cita ya pasó"
                : `Te esperamos, ${appointment.clientName.split(/\s+/)[0]}`}
        </h1>
        <p className="mt-2 text-[#CBD5E1]">
          {appointment.serviceName} con {appointment.memberName}
        </p>
        <p className="mt-1 text-lg font-semibold">{when.charAt(0).toUpperCase() + when.slice(1)}</p>
        <p className="mt-1 text-sm text-[#94A3B8]">{appointment.shopName}</p>
        {appointment.shopAddress ? (
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-[#94A3B8]">
            <MapPin aria-hidden="true" size={14} /> {appointment.shopAddress}
          </p>
        ) : null}
      </section>

      {appointment.canCancel ? (
        <details className={`${cardClass} p-4`}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center text-sm text-[#CBD5E1]">
            No puedo ir, quiero cancelar
          </summary>
          <form action={cancelMineAction} className="mt-3 flex flex-col gap-2">
            <input name="token" type="hidden" value={token} />
            <p className="text-center text-sm text-[#94A3B8]">La hora queda libre para otro cliente.</p>
            <button className={quietButtonClass} type="submit">
              Sí, cancelar mi cita
            </button>
          </form>
        </details>
      ) : null}

      <Link className={buttonClass} href={`/r/${appointment.slug}`}>
        {cancelled || appointment.status !== "booked" ? "Reservar otra cita" : "Reservar otra cita aparte"}
      </Link>
    </main>
  );
}
