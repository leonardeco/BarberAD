import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { PageTitle, cardClass, quietButtonClass } from "@/components/ui";
import { formatCop } from "@/server/money";
import { getShopContext } from "@/server/session";
import { listServices } from "@/server/shop";
import { addTemplateAction, deactivateServiceAction } from "./actions";
import { ServiceForm } from "./service-form";

export const metadata = { title: "Servicios" };

const templates = [
  { name: "Corte clásico", durationMin: 30, listPrice: 20000 },
  { name: "Fade / degradado", durationMin: 40, listPrice: 25000 },
  { name: "Barba", durationMin: 20, listPrice: 15000 },
  { name: "Corte + barba", durationMin: 50, listPrice: 35000 },
  { name: "Corte infantil", durationMin: 30, listPrice: 18000 },
  { name: "Cejas", durationMin: 10, listPrice: 8000 },
];

export default async function ServicesPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const services = await listServices(ctx, false);
  const taken = new Set(services.filter((item) => item.active).map((item) => item.name.toLowerCase()));
  const suggestions = templates.filter((item) => !taken.has(item.name.toLowerCase()));

  return (
    <>
      <PageTitle title="Servicios" detail="El precio de lista se copia en cada cobro. Cambiarlo no toca los cobros pasados." />

      {suggestions.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-[#CBD5E1]">Agrega en un toque</h2>
          <p className="text-xs text-[#94A3B8]">Precios de referencia. Los ajustas después.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <form key={item.name} action={addTemplateAction}>
                <input name="name" type="hidden" value={item.name} />
                <input name="durationMin" type="hidden" value={item.durationMin} />
                <input name="listPrice" type="hidden" value={item.listPrice} />
                <button
                  className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-[#CBD5E1] transition hover:border-[#D97706] hover:text-[#F8FAFC]"
                  type="submit"
                >
                  <Plus aria-hidden="true" size={16} />
                  {item.name}
                  <span className="text-[#94A3B8] tabular-nums">{formatCop(item.listPrice)}</span>
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <ServiceForm />

      {services.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Tu carta</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {services.map((service) => (
              <li key={service.id} className={`${cardClass} p-4 ${service.active ? "" : "opacity-60"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{service.name}</p>
                    <p className="text-sm text-[#94A3B8]">
                      {service.duration_min} min
                      {service.commission_percent !== null ? ` · comisión ${service.commission_percent}%` : ""}
                      {service.active ? "" : " · inactivo"}
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{formatCop(service.list_price)}</p>
                </div>
                {service.active ? (
                  <details className="group mt-3 border-t border-white/5 pt-3">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm text-[#D97706]">
                      <span className="group-open:hidden">Editar</span>
                      <span className="hidden group-open:inline">Cerrar</span>
                    </summary>
                    <ServiceForm
                      service={{
                        id: service.id,
                        name: service.name,
                        durationMin: service.duration_min,
                        listPrice: service.list_price,
                        commissionPercent: service.commission_percent,
                      }}
                    />
                    <form action={deactivateServiceAction} className="mt-2">
                      <input name="serviceId" type="hidden" value={service.id} />
                      <button className={`${quietButtonClass} w-full`} type="submit">
                        Desactivar servicio
                      </button>
                    </form>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
