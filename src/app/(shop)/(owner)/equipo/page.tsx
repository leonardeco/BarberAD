import { redirect } from "next/navigation";
import { PageTitle, cardClass, quietButtonClass } from "@/components/ui";
import { getShopContext } from "@/server/session";
import { listMembers } from "@/server/shop";
import { deactivateMemberAction } from "./actions";
import { BarberForm } from "./barber-form";

export const metadata = { title: "Equipo" };

export default async function TeamPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  const members = await listMembers(ctx);
  return (
    <>
      <PageTitle title="Equipo" detail="Cada barbero entra con su correo y solo ve sus cortes y su comisión." />
      <BarberForm />
      <section className="mt-8">
        <h2 className="text-lg font-semibold">En la barbería</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className={`${cardClass} flex items-center justify-between gap-3 p-4 ${member.active ? "" : "opacity-60"}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D97706]/20 text-sm font-semibold text-[#FBBF24]">
                  {member.display_name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.display_name}</p>
                  <p className="text-sm text-[#94A3B8]">
                    {member.role === "owner" ? "Dueño" : "Barbero"} · {member.commission_percent}%
                    {member.active ? "" : " · inactivo"}
                  </p>
                </div>
              </div>
              {member.role === "barber" && member.active ? (
                <form action={deactivateMemberAction}>
                  <input name="memberId" type="hidden" value={member.id} />
                  <button className={quietButtonClass} type="submit">
                    Desactivar
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
