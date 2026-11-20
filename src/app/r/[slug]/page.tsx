import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { publicShop } from "@/server/agenda";
import { Booking } from "./booking";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = await publicShop((await params).slug);
  return shop
    ? { title: `Reserva en ${shop.name}`, description: `Agenda tu cita en ${shop.name} en menos de un minuto.` }
    : { title: "Barbería no encontrada" };
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;
  const shop = await publicShop(slug);
  if (!shop) notFound();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-white/5 bg-[#1E293B]">
        <div className="mx-auto w-full max-w-xl px-4 py-6">
          <h1 className="text-2xl font-semibold tracking-tight">{shop.name}</h1>
          <div className="mt-2 flex flex-col gap-1 text-sm text-[#CBD5E1]">
            {shop.address ? (
              <span className="inline-flex items-center gap-2">
                <MapPin aria-hidden="true" size={16} /> {shop.address}
              </span>
            ) : null}
            {shop.phone ? (
              <span className="inline-flex items-center gap-2">
                <Phone aria-hidden="true" size={16} /> {shop.phone}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
        {shop.services.length === 0 || shop.barbers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-[#CBD5E1]">
            Esta barbería todavía no recibe reservas en línea.
          </p>
        ) : (
          <Booking shop={shop} slug={slug} />
        )}
        <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-[#94A3B8]">
          Reservas con <Logo size={20} />
        </footer>
      </main>
    </div>
  );
}
