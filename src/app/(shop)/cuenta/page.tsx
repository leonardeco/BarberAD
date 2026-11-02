import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { endSessionAction } from "@/app/session-action";
import { PageTitle, cardClass, quietButtonClass } from "@/components/ui";
import { getShopContext } from "@/server/session";
import { shopProfile } from "@/server/shop";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const profile = ctx.role === "owner" ? await shopProfile(ctx) : null;

  return (
    <>
      <PageTitle title="Mi cuenta" detail={`${ctx.displayName} · ${ctx.role === "owner" ? "Dueño" : "Barbero"} en ${ctx.shopName}`} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {profile ? <ProfileForm profile={profile} /> : null}
        <PasswordForm />
      </div>
      {ctx.role === "barber" ? (
        <p className={`${cardClass} mt-4 p-4 text-sm text-[#CBD5E1]`}>
          Tu comisión es del {ctx.commissionPercent}%. Si no es la acordada, háblalo con el dueño.
        </p>
      ) : null}
      <form action={endSessionAction} className="mt-6">
        <button className={`${quietButtonClass} w-full`} type="submit">
          <LogOut aria-hidden="true" size={18} />
          Salir de BarberAD
        </button>
      </form>
    </>
  );
}
