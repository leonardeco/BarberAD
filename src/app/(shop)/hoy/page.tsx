import Link from "next/link";
import { RefreshToday } from "@/components/refresh-today";
import { PageTitle } from "@/components/ui";
import { formatCop } from "@/server/money";
import { getShopContext } from "@/server/session";
import { listToday } from "@/server/shop";
import { redirect } from "next/navigation";

const methodLabel = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
};

export default async function TodayPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  const today = await listToday(ctx);
  return (
    <>
      <RefreshToday />
      <PageTitle
        title="Hoy"
        detail={
          today.drawerStatus === "closed"
            ? "La caja de hoy está cerrada."
            : "Los cortes de este día, en la hora de la barbería."
        }
      />
      <section className="grid grid-cols-2 gap-3">
        <article className="rounded-2xl bg-[#1E293B] p-4">
          <p className="text-sm text-[#CBD5E1]">Comisión</p>
          <p className="mt-1 text-[28px] font-semibold tabular-nums">{formatCop(today.commission)}</p>
        </article>
        <article className="rounded-2xl bg-[#1E293B] p-4">
          <p className="text-sm text-[#CBD5E1]">{ctx.role === "owner" ? "Efectivo" : "Cortes"}</p>
          <p className="mt-1 text-[28px] font-semibold tabular-nums">
            {ctx.role === "owner" ? formatCop(today.expectedCash) : today.checkouts.length}
          </p>
        </article>
      </section>
      {today.checkouts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 p-6">
          <p>Hoy todavía no hay cortes.</p>
          <Link className="mt-4 inline-flex h-12 items-center text-[#D97706]" href="/cobrar">
            Cobrar un corte
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {today.checkouts.map((cut) => (
            <li key={cut.id} className="rounded-2xl bg-[#1E293B] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{cut.serviceName}</p>
                  <p className="text-sm text-[#CBD5E1]">
                    {cut.barberName} · {methodLabel[cut.paymentMethod]}
                    {cut.tip > 0 ? ` · propina ${formatCop(cut.tip)}` : ""}
                  </p>
                </div>
                <p className="text-right tabular-nums">
                  <span className="block font-semibold">{formatCop(cut.charged)}</span>
                  <span className="text-sm text-[#CBD5E1]">{formatCop(cut.commissionAmount)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
