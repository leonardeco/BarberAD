import { redirect } from "next/navigation";
import { MessageCircle, Search, UserRound } from "lucide-react";
import { EmptyState, PageTitle, cardClass, inputClass, quietButtonClass } from "@/components/ui";
import { dayLabel, listClients } from "@/server/agenda";
import { getShopContext } from "@/server/session";
import { NotesForm } from "./notes-form";

export const metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const q = String((await searchParams).q ?? "");
  const clients = await listClients(ctx, q);
  return (
    <>
      <PageTitle title="Clientes" detail="Se crean solos cuando alguien reserva o le agendas una cita." />
      <form className="mb-6 flex gap-2" role="search">
        <input aria-label="Buscar cliente" className={inputClass} defaultValue={q} name="q" placeholder="Nombre o WhatsApp" />
        <button aria-label="Buscar" className={`${quietButtonClass} w-12 shrink-0 px-0`} type="submit">
          <Search aria-hidden="true" size={18} />
        </button>
      </form>
      {clients.length === 0 ? (
        <EmptyState
          icon={<UserRound aria-hidden="true" size={22} strokeWidth={1.75} />}
          title={q ? "Nadie con ese nombre o número" : "Todavía no hay clientes"}
          detail={q ? undefined : "Comparte tu enlace de reservas para que empiecen a llegar."}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {clients.map((client) => (
            <li key={client.id} className={`${cardClass} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{client.name}</p>
                  <p className="text-sm text-[#94A3B8]">
                    {client.visits === 1 ? "1 visita" : `${client.visits} visitas`}
                    {client.noShows ? ` · ${client.noShows} sin venir` : ""}
                    {client.lastVisit ? ` · última ${dayLabel(client.lastVisit, "short").toLowerCase()}` : ""}
                  </p>
                  {client.nextVisit ? (
                    <p className="text-sm text-[#BFDBFE]">
                      Próxima: {dayLabel(client.nextVisit.slice(0, 10), "short").toLowerCase()}, {client.nextVisit.slice(11)}
                    </p>
                  ) : null}
                </div>
                <a
                  aria-label={`Escribir a ${client.name} por WhatsApp`}
                  className={`${quietButtonClass} w-12 shrink-0 px-0`}
                  href={`https://wa.me/${client.phone}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageCircle aria-hidden="true" size={18} />
                </a>
              </div>
              <details className="group mt-2 border-t border-white/5 pt-1">
                <summary className="flex min-h-12 cursor-pointer list-none items-center text-sm text-[#D97706]">
                  <span className="group-open:hidden">{client.notes ? `Notas: ${client.notes.slice(0, 60)}${client.notes.length > 60 ? "…" : ""}` : "Agregar notas"}</span>
                  <span className="hidden group-open:inline">Cerrar</span>
                </summary>
                <NotesForm clientId={client.id} notes={client.notes} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
