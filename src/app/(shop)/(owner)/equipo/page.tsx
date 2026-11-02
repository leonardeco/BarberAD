import { redirect } from "next/navigation";
import { PageTitle, quietButtonClass } from "@/components/ui";
import { getShopContext } from "@/server/session";
import { listMembers } from "@/server/shop";
import { deactivateMemberAction } from "./actions";
import { BarberForm } from "./barber-form";

export default async function TeamPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  const members = await listMembers(ctx);
  return (
    <>
      <PageTitle title="Equipo" detail="La contraseña inicial se entrega una sola vez, aquí mismo." />
      <BarberForm />
      <ul className="mt-6 flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
            <div>
              <p className="font-medium">{member.display_name}</p>
              <p className="text-sm text-[#CBD5E1]">
                {member.role === "owner" ? "Dueño" : "Barbero"} · {member.commission_percent}%
                {member.active ? "" : " · inactivo"}
              </p>
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
    </>
  );
}
