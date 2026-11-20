import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { EmptyState, PageTitle, cardClass } from "@/components/ui";
import { dayLabel } from "@/server/agenda";
import { formatCop } from "@/server/money";
import { payoutHistory, pendingPayouts } from "@/server/reports";
import { getShopContext } from "@/server/session";
import { PayButton } from "./pay-button";

export const metadata = { title: "Liquidar" };

function span(from: string | null, to: string | null) {
  if (!from || !to) return "";
  return from === to ? dayLabel(from, "short") : `${dayLabel(from, "short")} al ${dayLabel(to, "short").toLowerCase()}`;
}

export default async function PayoutsPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const [pending, history] = await Promise.all([pendingPayouts(ctx), payoutHistory(ctx)]);
  return (
    <>
      <PageTitle
        title="Liquidar comisiones"
        detail="Lo que le debes a cada barbero desde su último pago: su comisión más sus propinas, que entraron a la caja."
      />
      {pending.length === 0 ? (
        <EmptyState icon={<Users aria-hidden="true" size={22} strokeWidth={1.75} />} title="No tienes barberos todavía" />
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((row) => {
            const total = row.commission + row.tips;
            return (
              <li key={row.memberId} className={`${cardClass} p-4`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatCop(total)}</p>
                </div>
                <p className="mt-1 text-sm text-[#CBD5E1]">
                  {row.cuts ? `${row.cuts === 1 ? "1 corte" : `${row.cuts} cortes`} · ${span(row.from, row.to)}` : "Nada pendiente"}
                </p>
                {row.cuts ? (
                  <p className="text-sm text-[#94A3B8]">
                    Comisión {formatCop(row.commission)} + propinas {formatCop(row.tips)}
                  </p>
                ) : null}
                <div className="mt-3">
                  <PayButton disabled={row.cuts === 0} label={formatCop(total)} memberId={row.memberId} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Pagos anteriores</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-[#94A3B8]">Todavía no has registrado pagos.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {history.map((row) => (
              <li key={row.id} className={`${cardClass} flex items-center justify-between gap-3 p-4`}>
                <div>
                  <p className="font-medium">{row.memberName}</p>
                  <p className="text-sm text-[#94A3B8]">
                    {row.cuts} cortes · {span(row.from, row.to)} · pagado {dayLabel(row.paidAt.slice(0, 10), "short").toLowerCase()}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{formatCop(row.commission + row.tips)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
