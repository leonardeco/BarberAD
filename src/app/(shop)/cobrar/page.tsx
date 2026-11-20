import Link from "next/link";
import { redirect } from "next/navigation";
import { Scissors } from "lucide-react";
import { EmptyState, PageTitle, buttonClass } from "@/components/ui";
import { getShopContext } from "@/server/session";
import { listMembers, listServices } from "@/server/shop";
import { appointmentForCheckout } from "@/server/agenda";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "Cobrar" };

export default async function ChargePage({ searchParams }: { searchParams: Promise<{ cita?: string }> }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const citaId = (await searchParams).cita;
  const appointment = citaId ? await appointmentForCheckout(ctx, citaId) : null;
  if (citaId && !appointment) redirect("/agenda");
  if (appointment) {
    return (
      <>
        <PageTitle title="Cobrar cita" detail="El servicio y el barbero vienen de la cita. Ajusta el monto si hubo algo extra o un descuento." />
        <CheckoutForm
          appointment={{
            id: appointment.id,
            clientName: appointment.clientName,
            memberName: appointment.memberName,
            time: appointment.time,
          }}
          services={[
            {
              id: appointment.serviceId,
              name: appointment.serviceName,
              durationMin: appointment.durationMin,
              listPrice: appointment.listPrice,
            },
          ]}
        />
      </>
    );
  }
  const [services, members] = await Promise.all([
    listServices(ctx, true),
    ctx.role === "owner" ? listMembers(ctx) : Promise.resolve([]),
  ]);
  const barbers = members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.display_name }));
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
          barbers={barbers}
          selfId={ctx.memberId}
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
