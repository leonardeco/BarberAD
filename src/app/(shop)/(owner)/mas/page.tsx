import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, BarChart3, BellRing, ChevronRight, HandCoins, Clock, Contact, Scissors, UserRound, Users } from "lucide-react";
import { PageTitle, cardClass } from "@/components/ui";
import { shopSlug } from "@/server/agenda";
import { appUrl } from "@/server/mail";
import { getShopContext } from "@/server/session";
import { CopyLink } from "@/components/copy-link";

export const metadata = { title: "Más" };

const items = [
  { href: "/avisos", label: "Avisos por WhatsApp", detail: "Recordatorios y mensajes por enviar", icon: BellRing },
  { href: "/reportes", label: "Reportes", detail: "Ganancias por día, semana y mes", icon: BarChart3 },
  { href: "/liquidar", label: "Liquidar comisiones", detail: "Lo que le debes a cada barbero", icon: HandCoins },
  { href: "/clientes", label: "Clientes", detail: "Historial, notas y WhatsApp", icon: Contact },
  { href: "/servicios", label: "Servicios", detail: "Tu carta y sus precios", icon: Scissors },
  { href: "/equipo", label: "Equipo", detail: "Barberos y comisiones", icon: Users },
  { href: "/horarios", label: "Horarios", detail: "Quién atiende y cuándo", icon: Clock },
  { href: "/plan", label: "Tu plan", detail: "Gratis o Pro, y lo que llevas usado", icon: Crown },
  { href: "/cuenta", label: "Mi cuenta", detail: "Datos de la barbería y contraseña", icon: UserRound },
];

export default async function MorePage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const slug = await shopSlug(ctx);
  return (
    <>
      <PageTitle title="Más" />
      {slug ? <CopyLink url={`${appUrl()}/r/${slug}`} /> : null}
      <ul className="mt-6 flex flex-col gap-2">
        {items.map(({ href, label, detail, icon: Icon }) => (
          <li key={href}>
            <Link className={`${cardClass} flex min-h-16 items-center gap-3 px-4`} href={href}>
              <Icon aria-hidden="true" className="text-[#D97706]" size={20} />
              <span className="flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-[#94A3B8]">{detail}</span>
              </span>
              <ChevronRight aria-hidden="true" className="text-[#94A3B8]" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
