import Link from "next/link";
import { redirect } from "next/navigation";
import { Scissors } from "lucide-react";
import { EmptyState, PageTitle, buttonClass } from "@/components/ui";
import { getShopContext } from "@/server/session";
import { listServices } from "@/server/shop";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "Cobrar" };

export default async function ChargePage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const services = await listServices(ctx, true);
  return (
    <>
      <PageTitle title="Cobrar" detail="Servicio, monto y pago. La comisión sale sola." />
      {services.length === 0 ? (
        <EmptyState
          icon={<Scissors aria-hidden="true" size={22} strokeWidth={1.75} />}
          title={ctx.role === "owner" ? "Primero arma tu carta" : "Aún no hay servicios"}
          detail={
            ctx.role === "owner"
              ? "Agrega los cortes que ofreces con su precio y vuelve aquí."
              : "Pídele al dueño que cargue los servicios."
          }
        >
          {ctx.role === "owner" ? (
            <Link className={buttonClass} href="/servicios">
              Ir a servicios
            </Link>
          ) : null}
        </EmptyState>
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
