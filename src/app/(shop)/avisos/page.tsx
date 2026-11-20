import { redirect } from "next/navigation";
import { BellRing } from "lucide-react";
import { EmptyState, PageTitle, cardClass } from "@/components/ui";
import { getTemplates, reminderQueue, type ReminderItem } from "@/server/reminders";
import { getShopContext } from "@/server/session";
import { SendButton } from "./send-button";
import { TemplatesForm } from "./templates-form";

export const metadata = { title: "Avisos" };

function Group({ title, detail, items }: { title: string; detail: string; items: ReminderItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">
        {title} <span className="text-sm font-normal text-[#94A3B8]">· {items.length}</span>
      </h2>
      <p className="text-sm text-[#94A3B8]">{detail}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className={`${cardClass} flex items-center gap-3 p-4`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.clientName}</p>
              <p className="truncate text-sm text-[#CBD5E1]">{item.detail}</p>
            </div>
            <SendButton id={item.id} kind={item.kind} url={item.url} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function RemindersPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const [queue, templates] = await Promise.all([
    reminderQueue(ctx),
    ctx.role === "owner" ? getTemplates(ctx) : Promise.resolve(null),
  ]);
  const total = queue.tomorrow.length + queue.soon.length + queue.thanks.length + queue.comeback.length;

  return (
    <>
      <PageTitle
        title="Avisos"
        detail="Cada botón abre WhatsApp con el mensaje escrito. Lo envías tú y aquí queda anotado."
      />
      {total === 0 ? (
        <EmptyState
          icon={<BellRing aria-hidden="true" size={22} strokeWidth={1.75} />}
          title="Todo al día"
          detail="Aquí aparecen los recordatorios de las citas de mañana y de las próximas horas, y los mensajes para después de la cita."
        />
      ) : null}
      <Group detail="Recuérdales hoy su cita de mañana. Es lo que más baja los que no llegan." items={queue.tomorrow} title="Citas de mañana" />
      <Group detail="Citas de las próximas 3 horas que no tienen recordatorio." items={queue.soon} title="En un rato" />
      <Group detail="Agradece la visita y deja tu enlace para la próxima." items={queue.thanks} title="Después de la cita" />
      <Group detail="Clientes que no vienen hace más de 3 semanas y no tienen cita." items={queue.comeback} title="Hace rato no vienen" />

      {templates ? (
        <details className="group mt-10">
          <summary className="flex min-h-12 cursor-pointer list-none items-center text-[#D97706]">
            <span className="group-open:hidden">Editar los mensajes</span>
            <span className="hidden group-open:inline">Cerrar</span>
          </summary>
          <div className="mt-2">
            <TemplatesForm templates={templates} />
          </div>
        </details>
      ) : null}
    </>
  );
}
