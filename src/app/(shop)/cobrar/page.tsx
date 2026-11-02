import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { getShopContext } from "@/server/session";
import { listServices } from "@/server/shop";
import { CheckoutForm } from "./checkout-form";

export default async function ChargePage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  const services = await listServices(ctx, true);
  return (
    <>
      <PageTitle title="Cobrar" detail="Servicio, monto y pago." />
      {services.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-6">
          <p>{ctx.role === "owner" ? "Primero crea un servicio." : "Pídele al dueño que cargue los servicios."}</p>
          {ctx.role === "owner" ? (
            <Link className="mt-4 inline-flex h-12 items-center text-[#D97706]" href="/servicios">
              Ir a servicios
            </Link>
          ) : null}
        </div>
      ) : (
        <CheckoutForm
          services={services.map((service) => ({
            id: service.id,
            name: service.name,
            durationMin: service.duration_min,
            listPrice: service.list_price,
          }))}
        />
      )}
    </>
  );
}
