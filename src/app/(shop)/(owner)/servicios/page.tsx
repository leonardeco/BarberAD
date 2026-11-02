import { redirect } from "next/navigation";
import { PageTitle, quietButtonClass } from "@/components/ui";
import { formatCop } from "@/server/money";
import { getShopContext } from "@/server/session";
import { listServices } from "@/server/shop";
import { deactivateServiceAction } from "./actions";
import { ServiceForm } from "./service-form";

export default async function ServicesPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  const services = await listServices(ctx, false);
  return (
    <>
      <PageTitle title="Servicios" detail="El precio de lista se copia en cada cobro." />
      <ServiceForm />
      <ul className="mt-6 flex flex-col gap-3">
        {services.map((service) => (
          <li key={service.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
            <div>
              <p className="font-medium">{service.name}</p>
              <p className="text-sm text-[#CBD5E1]">
                {service.duration_min} min · {formatCop(service.list_price)}
                {service.active ? "" : " · inactivo"}
              </p>
            </div>
            {service.active ? (
              <form action={deactivateServiceAction}>
                <input name="serviceId" type="hidden" value={service.id} />
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
