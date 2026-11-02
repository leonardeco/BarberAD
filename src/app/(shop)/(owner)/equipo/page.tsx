import { redirect } from "next/navigation";
import { PageTitle, cardClass, quietButtonClass } from "@/components/ui";
import { memberEmails } from "@/server/auth";
import { getShopContext } from "@/server/session";
import { listMembers } from "@/server/shop";
import { deactivateMemberAction } from "./actions";
import { BarberForm } from "./barber-form";
import { MemberTools } from "./member-tools";

export const metadata = { title: "Equipo" };

export default async function TeamPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const [members, emails] = await Promise.all([listMembers(ctx), memberEmails(ctx)]);
  return (
    <>
      <PageTitle title="Equipo" detail="Cada barbero entra con su correo y solo ve sus cortes y su comisión." />
      <BarberForm />
      <section className="mt-8">
        <h2 className="text-lg font-semibold">En la barbería</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.id} className={`${cardClass} p-4 ${member.active ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D97706]/20 text-sm font-semibold text-[#FBBF24]">
                  {member.display_name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{member.display_name}</p>
                  <p className="truncate text-sm text-[#94A3B8]">
                    {member.role === "owner" ? "Dueño" : "Barbero"} · {member.commission_percent}%
                    {member.active ? "" : " · inactivo"}
                    {emails.get(member.id) ? ` · ${emails.get(member.id)}` : ""}
                  </p>
                </div>
              </div>
              {member.role === "barber" && member.active ? (
                <details className="group mt-3 border-t border-white/5 pt-1">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center text-sm text-[#D97706]">
                    <span className="group-open:hidden">Comisión y contraseña</span>
                    <span className="hidden group-open:inline">Cerrar</span>
                  </summary>
                  <MemberTools commissionPercent={member.commission_percent} memberId={member.id} />
                  <form action={deactivateMemberAction} className="mt-4">
                    <input name="memberId" type="hidden" value={member.id} />
                    <button className={`${quietButtonClass} w-full`} type="submit">
                      Desactivar barbero
                    </button>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
