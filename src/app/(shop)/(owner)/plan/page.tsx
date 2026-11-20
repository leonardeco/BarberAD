import { redirect } from "next/navigation";
import { Check, Crown } from "lucide-react";
import { RefreshToday } from "@/components/refresh-today";
import { Notice, PageTitle, cardClass } from "@/components/ui";
import { dayLabel } from "@/server/agenda";
import { FREE_LIMITS, planStatus, wompiEnabled } from "@/server/billing";
import { formatCop } from "@/server/money";
import { proOptions, proPrice, proTotal } from "@/server/plans";
import { getShopContext } from "@/server/session";
import { BuyForm } from "./buy-form";

export const metadata = { title: "Plan" };

const statusText: Record<string, string> = {
  pending: "Esperando confirmación",
  approved: "Aprobado",
  declined: "Rechazado",
  voided: "Anulado",
  error: "Con error",
};

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-[#CBD5E1]">{label}</span>
        <span className="tabular-nums">
          {used} de {max}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#0F172A]">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-[#DC2626]" : pct >= 80 ? "bg-[#F59E0B]" : "bg-[#D97706]"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const { ref } = await searchParams;
  const status = await planStatus(ctx);
  const returned = ref ? status.payments.find((p) => p.reference === ref) : undefined;
  const options = proOptions.map((option) => {
    const total = proTotal(option.months)!;
    return { ...option, total, totalLabel: formatCop(total), perMonth: formatCop(Math.round(total / option.months)) };
  });

  return (
    <>
      {returned?.status === "pending" ? <RefreshToday /> : null}
      <PageTitle title="Tu plan" detail={status.pro ? `Pro hasta el ${dayLabel(status.until!).toLowerCase()}` : "Estás en el plan Gratis"} />

      {returned ? (
        <div className="mb-4">
          <Notice tone={returned.status === "approved" ? "ok" : returned.status === "pending" ? "ok" : "error"}>
            {returned.status === "approved"
              ? "¡Pago aprobado! Tu plan Pro ya está activo."
              : returned.status === "pending"
                ? "Estamos esperando que Wompi confirme tu pago. Esta pantalla se actualiza sola."
                : "El pago no se aprobó. Puedes intentarlo otra vez."}
          </Notice>
        </div>
      ) : null}

      {!status.pro ? (
        <section className={`${cardClass} flex flex-col gap-4 p-5`}>
          <h2 className="font-semibold">Uso de este mes</h2>
          <Usage label="Barberos" max={FREE_LIMITS.barbers} used={status.barbers} />
          <Usage label="Reservas en línea" max={FREE_LIMITS.onlineBookingsPerMonth} used={status.onlineBookings} />
          <p className="text-sm text-[#94A3B8]">
            Al llegar al límite de reservas, tu enlace deja de recibir citas hasta el próximo mes. Las citas que agendas a mano no cuentan.
          </p>
        </section>
      ) : null}

      <section className={`${cardClass} mt-4 border-[#D97706]/40 p-5`}>
        <div className="flex items-center gap-2">
          <Crown aria-hidden="true" className="text-[#FBBF24]" size={20} />
          <h2 className="text-lg font-semibold">Plan Pro</h2>
          <span className="ml-auto text-sm text-[#CBD5E1]">desde {formatCop(Math.round(proTotal(12)! / 12))}/mes</span>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[#CBD5E1]">
          {["Barberos ilimitados", "Reservas en línea ilimitadas", "Todo lo del plan Gratis: agenda, cobros, caja, reportes y avisos"].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 shrink-0 text-[#4ADE80]" size={16} /> {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[#94A3B8]">
          {formatCop(proPrice())} al mes. {status.pro ? "Si pagas ahora, se suma al tiempo que te queda." : ""}
        </p>
        <div className="mt-4">
          <BuyForm enabled={wompiEnabled()} options={options} />
        </div>
      </section>

      {status.payments.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Pagos</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {status.payments.map((payment) => (
              <li key={payment.reference} className={`${cardClass} flex items-center justify-between gap-3 p-4 text-sm`}>
                <span>
                  {payment.months === 1 ? "1 mes" : `${payment.months} meses`} · {dayLabel(payment.createdAt, "short")}
                  <span className="block text-xs text-[#94A3B8]">{statusText[payment.status] ?? payment.status}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatCop(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
