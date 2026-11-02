import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { PageTitle, Stat, cardClass } from "@/components/ui";
import { formatCop } from "@/server/money";
import { getShopContext } from "@/server/session";
import { listToday, recentDrawers } from "@/server/shop";
import { CloseForm } from "./close-form";

export const metadata = { title: "Caja" };

function shortDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default async function DrawerPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  const [today, history] = await Promise.all([listToday(ctx), recentDrawers(ctx)]);
  const closed = today.drawerStatus === "closed";
  const todayClose = closed ? history.find((row) => row.day === today.day) : undefined;

  return (
    <>
      <PageTitle title="Caja" detail="Lo que debe haber en la gaveta sale de los cobros en efectivo más sus propinas." />

      <section className={`${cardClass} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#CBD5E1]">Efectivo esperado</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              closed ? "bg-white/10 text-[#CBD5E1]" : "bg-[#14532D]/50 text-[#BBF7D0]"
            }`}
          >
            {closed ? <Lock aria-hidden="true" size={12} /> : null}
            {closed ? "Cerrada" : "Abierta"}
          </span>
        </div>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatCop(today.expectedCash)}</p>
        {todayClose ? (
          <p className="mt-2 text-sm text-[#CBD5E1]">
            Contaste {formatCop(todayClose.countedCash)}.{" "}
            {todayClose.countedCash === todayClose.expectedCash
              ? "Cuadró exacto."
              : todayClose.countedCash > todayClose.expectedCash
                ? `Sobraron ${formatCop(todayClose.countedCash - todayClose.expectedCash)}.`
                : `Faltaron ${formatCop(todayClose.expectedCash - todayClose.countedCash)}.`}
          </p>
        ) : null}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cobrado" value={formatCop(today.charged)} />
        <Stat label="Transferencias" value={formatCop(today.byMethod.transfer)} />
        <Stat label="Tarjeta" value={formatCop(today.byMethod.card)} />
        <Stat label="Propinas" value={formatCop(today.tips)} />
      </section>

      {closed ? null : <CloseForm expectedCash={today.expectedCash} />}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Últimos cierres</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-[#94A3B8]">Todavía no has cerrado ninguna caja.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {history.map((row) => {
              const gap = row.countedCash - row.expectedCash;
              return (
                <li key={row.day} className={`${cardClass} flex items-center justify-between gap-3 p-4`}>
                  <div>
                    <p className="font-medium capitalize">{shortDay(row.day)}</p>
                    <p className="text-sm text-[#94A3B8]">
                      Esperado {formatCop(row.expectedCash)} · contado {formatCop(row.countedCash)}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      gap === 0 ? "text-[#BBF7D0]" : gap > 0 ? "text-[#FBBF24]" : "text-[#FECACA]"
                    }`}
                  >
                    {gap === 0 ? "Cuadró" : `${gap > 0 ? "+" : "−"}${formatCop(Math.abs(gap))}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
