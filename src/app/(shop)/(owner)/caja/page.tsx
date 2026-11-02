import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { formatCop } from "@/server/money";
import { getShopContext } from "@/server/session";
import { listToday } from "@/server/shop";
import { CloseForm } from "./close-form";

export default async function DrawerPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  const today = await listToday(ctx);
  return (
    <>
      <PageTitle title="Caja" detail="El efectivo esperado sale de los cobros en efectivo más la propina." />
      <article className="rounded-2xl bg-[#1E293B] p-4">
        <p className="text-sm text-[#CBD5E1]">Efectivo esperado</p>
        <p className="mt-1 text-[32px] font-semibold tabular-nums">{formatCop(today.expectedCash)}</p>
        <p className="mt-2 text-sm text-[#CBD5E1]">
          {today.drawerStatus === "closed" ? "Esta caja ya está cerrada." : "Sigue abierta."}
        </p>
      </article>
      {today.drawerStatus === "open" ? <CloseForm /> : null}
    </>
  );
}
