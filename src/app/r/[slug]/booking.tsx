"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarCheck, Check } from "lucide-react";
import { Field, Notice, buttonClass, cardClass, inputClass } from "@/components/ui";
import type { PublicShop, Slot } from "@/server/agenda";
import { bookAction, slotsAction } from "./actions";

const steps = ["Servicio", "Barbero", "Hora", "Tus datos"];

function cop(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function nextDays(today: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const day = date.toISOString().slice(0, 10);
    return {
      day,
      weekday: index === 0 ? "Hoy" : index === 1 ? "Mañana" : date.toLocaleDateString("es-CO", { timeZone: "UTC", weekday: "short" }),
      number: date.getUTCDate(),
      month: date.toLocaleDateString("es-CO", { timeZone: "UTC", month: "short" }),
    };
  });
}

function longWhen(iso: string, timezone: string) {
  const text = new Date(iso).toLocaleString("es-CO", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function Booking({ shop, slug }: { shop: PublicShop; slug: string }) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const days = useMemo(() => nextDays(shop.today, 14), [shop.today]);
  const [day, setDay] = useState(shop.today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ memberName: string; startsAt: string } | null>(null);

  const service = shop.services.find((item) => item.id === serviceId);
  const barber = shop.barbers.find((item) => item.id === memberId);

  useEffect(() => {
    if (step !== 3 || !serviceId) return;
    let alive = true;
    setSlots(null);
    slotsAction({ slug, serviceId, memberId, day })
      .then((result) => {
        if (alive) setSlots(result);
      })
      .catch(() => {
        if (alive) setSlots([]);
      });
    return () => {
      alive = false;
    };
  }, [step, slug, serviceId, memberId, day]);

  const times = useMemo(() => {
    const seen = new Map<string, Slot>();
    for (const slot of slots ?? []) if (!seen.has(slot.startsAt)) seen.set(slot.startsAt, slot);
    return [...seen.values()];
  }, [slots]);

  async function confirm() {
    setPending(true);
    setMessage("");
    try {
      const result = await bookAction({ slug, serviceId, memberId, startsAt, name, phone });
      if (result.ok) {
        setDone({ memberName: result.memberName, startsAt: result.startsAt });
      } else {
        setMessage(result.message);
        if (result.message.includes("ocupar")) {
          setStartsAt("");
          setStep(3);
        }
      }
    } catch {
      setMessage("No hay conexión. Revisa la señal e inténtalo otra vez.");
    } finally {
      setPending(false);
    }
  }

  if (done && service) {
    return (
      <section className={`${cardClass} p-6 text-center`}>
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#14532D] text-[#BBF7D0]">
          <CalendarCheck aria-hidden="true" size={28} />
        </span>
        <h2 className="mt-4 text-xl font-semibold">¡Listo, tu cita quedó reservada!</h2>
        <p className="mt-2 text-[#CBD5E1]">
          {service.name} con {done.memberName}
        </p>
        <p className="mt-1 text-lg font-semibold">{longWhen(done.startsAt, shop.timezone)}</p>
        <p className="mt-4 text-sm text-[#94A3B8]">
          Si no puedes venir, avísale a la barbería{shop.phone ? ` al ${shop.phone}` : ""}.
        </p>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        {step > 1 ? (
          <button
            aria-label="Volver"
            className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 text-[#CBD5E1]"
            onClick={() => setStep(step - 1)}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
        ) : null}
        <ol aria-label={`Paso ${step} de ${steps.length}`} className="grid flex-1 grid-cols-4 gap-2">
          {steps.map((label, index) => (
            <li key={label}>
              <span className={`block h-1.5 rounded-full ${index < step ? "bg-[#D97706]" : "bg-white/10"}`} />
              <span className={`mt-1.5 block text-xs ${index + 1 === step ? "text-[#F8FAFC]" : "text-[#94A3B8]"}`}>{label}</span>
            </li>
          ))}
        </ol>
      </div>

      {step === 1 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">¿Qué te vas a hacer?</h2>
          <div className="flex flex-col gap-2">
            {shop.services.map((item) => (
              <button
                key={item.id}
                className={`${cardClass} flex min-h-16 cursor-pointer items-center justify-between gap-3 px-4 text-left transition hover:border-[#D97706]/60`}
                onClick={() => {
                  setServiceId(item.id);
                  setStartsAt("");
                  setStep(shop.barbers.length > 1 ? 2 : 3);
                  if (shop.barbers.length === 1) setMemberId(shop.barbers[0].id);
                }}
                type="button"
              >
                <span>
                  <span className="block font-medium">{item.name}</span>
                  <span className="text-sm text-[#94A3B8]">{item.durationMin} min</span>
                </span>
                <span className="font-semibold tabular-nums">{cop(item.listPrice)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">¿Con quién?</h2>
          <div className="flex flex-col gap-2">
            {[{ id: null as string | null, name: "Con quien esté libre" }, ...shop.barbers].map((item) => (
              <button
                key={item.id ?? "any"}
                className={`${cardClass} flex min-h-14 cursor-pointer items-center gap-3 px-4 text-left transition hover:border-[#D97706]/60`}
                onClick={() => {
                  setMemberId(item.id);
                  setStartsAt("");
                  setStep(3);
                }}
                type="button"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#D97706]/20 text-sm font-semibold text-[#FBBF24]">
                  {item.id ? item.name.charAt(0).toUpperCase() : "★"}
                </span>
                <span className="font-medium">{item.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">¿Cuándo?</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {days.map((item) => (
              <button
                key={item.day}
                aria-pressed={item.day === day}
                className={`flex h-20 w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border text-sm ${
                  item.day === day ? "border-[#D97706] bg-[#D97706] font-semibold text-[#0F172A]" : "border-white/10 text-[#CBD5E1]"
                }`}
                onClick={() => {
                  setDay(item.day);
                  setStartsAt("");
                }}
                type="button"
              >
                <span className="text-xs capitalize">{item.weekday}</span>
                <span className="text-lg font-semibold">{item.number}</span>
                <span className="text-xs">{item.month}</span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            {slots === null ? (
              <p className="text-sm text-[#94A3B8]">Buscando horas libres…</p>
            ) : times.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-[#CBD5E1]">
                No quedan horas libres este día. Prueba otro.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {times.map((slot) => (
                  <button
                    key={slot.startsAt}
                    aria-pressed={slot.startsAt === startsAt}
                    className={`h-12 cursor-pointer rounded-xl border text-sm tabular-nums ${
                      slot.startsAt === startsAt ? "border-[#D97706] bg-[#D97706] font-semibold text-[#0F172A]" : "border-white/10 text-[#F8FAFC]"
                    }`}
                    onClick={() => {
                      setStartsAt(slot.startsAt);
                      setStep(4);
                    }}
                    type="button"
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>
          {message ? <div className="mt-4"><Notice tone="error">{message}</Notice></div> : null}
        </section>
      ) : null}

      {step === 4 && service && startsAt ? (
        <section className="flex flex-col gap-4">
          <div className={`${cardClass} p-4`}>
            <p className="font-medium">{service.name} · {cop(service.listPrice)}</p>
            <p className="text-sm text-[#CBD5E1]">
              {longWhen(startsAt, shop.timezone)}
              {barber ? ` · con ${barber.name}` : ""}
            </p>
          </div>
          <Field label="Tu nombre">
            <input autoComplete="name" className={inputClass} maxLength={80} onChange={(e) => setName(e.target.value)} value={name} />
          </Field>
          <Field label="Tu WhatsApp" hint="Para avisarte si hay algún cambio.">
            <input
              autoComplete="tel"
              className={inputClass}
              inputMode="tel"
              maxLength={20}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 123 4567"
              value={phone}
            />
          </Field>
          {message ? <Notice tone="error">{message}</Notice> : null}
          <button
            className={buttonClass}
            disabled={pending || !name.trim() || phone.replace(/\D/g, "").length < 7}
            onClick={confirm}
            type="button"
          >
            <Check aria-hidden="true" size={18} />
            {pending ? "Reservando…" : "Confirmar reserva"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
