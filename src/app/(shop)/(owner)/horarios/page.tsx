import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { listSchedules } from "@/server/agenda";
import { getShopContext } from "@/server/session";
import { ScheduleForm } from "./schedule-form";

export const metadata = { title: "Horarios" };

export default async function SchedulesPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const members = await listSchedules(ctx);
  return (
    <>
      <PageTitle title="Horarios" detail="Los clientes solo ven horas libres dentro de estos horarios. Los cambios no mueven las citas ya reservadas." />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {members.map((member) => (
          <ScheduleForm key={member.id} member={member} />
        ))}
      </div>
    </>
  );
}
