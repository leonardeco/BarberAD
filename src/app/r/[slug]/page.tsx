import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, MapPin, MessageCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { publicShop, type PublicShop } from "@/server/agenda";
import { appUrl } from "@/server/mail";
import { Booking } from "./booking";

type Props = { params: Promise<{ slug: string }> };

const weekdayNames = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function hm(minutes: number) {
  if (minutes >= 1440) return "24:00";
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

// Agrupa días seguidos con el mismo horario: "Lunes a viernes 9:00–19:00".
function scheduleLines(hours: PublicShop["hours"]) {
  const lines: { days: string; time: string }[] = [];
  let i = 0;
  while (i < hours.length) {
    let j = i;
    while (
      j + 1 < hours.length &&
      hours[j + 1].weekday === hours[j].weekday + 1 &&
      hours[j + 1].start === hours[i].start &&
      hours[j + 1].end === hours[i].end
    ) j += 1;
    const first = weekdayNames[hours[i].weekday];
    const last = weekdayNames[hours[j].weekday].toLowerCase();
    lines.push({
      days: i === j ? first : j === i + 1 ? `${first} y ${last}` : `${first} a ${last}`,
      time: `${hm(hours[i].start)}–${hm(hours[i].end)}`,
    });
    i = j + 1;
  }
  return lines;
}

function whatsappDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await publicShop(slug);
  if (!shop) return { title: "Barbería no encontrada" };
  const description = shop.about || `Reserva tu cita en ${shop.name} en menos de un minuto, sin llamar.`;
  return {
    title: `Reserva en ${shop.name}`,
    description,
    alternates: { canonical: `${appUrl()}/r/${slug}` },
    openGraph: {
      title: `Reserva en ${shop.name}`,
      description,
      url: `${appUrl()}/r/${slug}`,
      siteName: "BarberAD",
      locale: "es_CO",
      type: "website",
      images: [{ url: `${appUrl()}/og.png`, width: 1200, height: 630 }],
    },
  };
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;
  const shop = await publicShop(slug);
  if (!shop) notFound();
  const lines = scheduleLines(shop.hours);
  const wa = shop.phone ? whatsappDigits(shop.phone) : "";

  return (
    <div className="min-h-dvh">
      <header className="border-b border-white/5 bg-[#1E293B]">
        <div className="mx-auto w-full max-w-xl px-4 py-6">
          <h1 className="text-2xl font-semibold tracking-tight">{shop.name}</h1>
          {shop.about ? <p className="mt-2 text-[#CBD5E1]">{shop.about}</p> : null}
          <div className="mt-4 flex flex-col gap-2 text-sm text-[#CBD5E1]">
            {shop.address ? (
              <a
                className="inline-flex items-start gap-2 hover:text-[#F8FAFC]"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.address}`)}`}
                rel="noreferrer"
                target="_blank"
              >
                <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-[#D97706]" size={16} />
                <span>
                  {shop.address} <span className="text-[#D97706]">· Ver mapa</span>
                </span>
              </a>
            ) : null}
            {lines.length ? (
              <div className="inline-flex items-start gap-2">
                <Clock aria-hidden="true" className="mt-0.5 shrink-0 text-[#D97706]" size={16} />
                <ul>
                  {lines.map((line) => (
                    <li key={line.days}>
                      {line.days} <span className="tabular-nums text-[#F8FAFC]">{line.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {wa || shop.instagram ? (
            <div className="mt-4 flex gap-2">
              {wa ? (
                <a
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm hover:border-white/25"
                  href={`https://wa.me/${wa}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageCircle aria-hidden="true" size={16} /> WhatsApp
                </a>
              ) : null}
              {shop.instagram ? (
                <a
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm hover:border-white/25"
                  href={`https://instagram.com/${shop.instagram}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  @{shop.instagram}
                </a>
              ) : null}
            </div>
          ) : null}
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
        <footer className="mt-12 flex flex-col items-center gap-2 text-xs text-[#94A3B8]">
          <span className="flex items-center gap-2">
            Reservas con <Logo size={20} />
          </span>
          <a className="hover:text-[#CBD5E1]" href="/privacidad">
            Tratamiento de datos
          </a>
        </footer>
      </main>
    </div>
  );
}
