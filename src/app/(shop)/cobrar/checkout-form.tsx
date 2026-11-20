"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Banknote, Check, CreditCard } from "lucide-react";
import { chargeAction } from "./actions";
import { Notice, buttonClass, cardClass, inputClass, quietButtonClass } from "@/components/ui";
import { formatCop } from "@/server/money";

type Service = { id: string; name: string; durationMin: number; listPrice: number };

const methods = [
  { id: "cash", label: "Efectivo", icon: Banknote },
  { id: "transfer", label: "Transferencia", icon: ArrowLeftRight },
  { id: "card", label: "Tarjeta", icon: CreditCard },
] as const;

const tipOptions = [0, 2000, 5000, 10000];
const stepNames = ["Servicio", "Monto", "Pago"];

type FromAppointment = { id: string; clientName: string; memberName: string; time: string };

export function CheckoutForm({
  services,
  appointment,
  barbers,
  selfId,
}: {
  services: Service[];
  appointment?: FromAppointment;
  barbers?: { id: string; name: string }[];
  selfId?: string;
}) {
  const [memberId, setMemberId] = useState(selfId ?? "");
  const router = useRouter();
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(appointment ? 2 : 1);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((item) => item.id === serviceId) ?? services[0];
  const [amount, setAmount] = useState(String(service?.listPrice ?? ""));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<(typeof methods)[number]["id"]>("cash");
  const [tip, setTip] = useState("0");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<{
    charged: number;
    tip: number;
    commissionAmount: number;
    serviceName: string;
  } | null>(null);

  if (!service) return null;
  const parsedAmount = /^\d+$/.test(amount) ? Number(amount) : Number.NaN;
  const amountOk = Number.isInteger(parsedAmount);
  const needsReason = amountOk && parsedAmount < service.listPrice;
  const extra = amountOk && parsedAmount > service.listPrice ? parsedAmount - service.listPrice : 0;
  const canContinue = amountOk && (!needsReason || reason.trim().length > 0);

  function chooseService(next: Service) {
    setServiceId(next.id);
    setAmount(String(next.listPrice));
    setReason("");
    setMessage("");
    setStep(2);
  }

  function startOver() {
    setReceipt(null);
    setClientKey(crypto.randomUUID());
    setStep(1);
    setTip("0");
    setMethod("cash");
    setMemberId(selfId ?? "");
    setReason("");
    setMessage("");
  }

  async function confirm() {
    setPending(true);
    setMessage("");
    try {
      const result = await chargeAction({
        serviceId: service.id,
        amount: parsedAmount,
        reason,
        tip: tip === "" ? 0 : Number(tip),
        paymentMethod: method,
        clientKey,
        appointmentId: appointment?.id ?? null,
        memberId: appointment ? null : memberId || null,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setReceipt(result.receipt);
      // Recargar esta página con una cita ya cobrada la mandaría a la agenda y se perdería el recibo.
      if (!appointment) router.refresh();
    } catch {
      // Sin señal el celular no llega al servidor. La misma clave de cobro se reenvía al
      // reintentar, así que si el primer intento sí llegó no se cobra dos veces.
      setMessage("No hay conexión con el servidor. Revisa la señal y toca Confirmar cobro otra vez: no se cobra dos veces.");
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <section className={`${cardClass} p-6 text-center`}>
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#14532D] text-[#BBF7D0]">
          <Check aria-hidden="true" size={28} strokeWidth={2.5} />
        </span>
        <p className="mt-4 text-sm text-[#CBD5E1]">{receipt.serviceName}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatCop(receipt.charged)}</p>
        <dl className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2 text-left">
          <div className="rounded-xl bg-[#0F172A]/60 px-3 py-2">
            <dt className="text-xs text-[#94A3B8]">Propina</dt>
            <dd className="font-semibold tabular-nums">{formatCop(receipt.tip)}</dd>
          </div>
          <div className="rounded-xl bg-[#0F172A]/60 px-3 py-2">
            <dt className="text-xs text-[#94A3B8]">Comisión</dt>
            <dd className="font-semibold tabular-nums">{formatCop(receipt.commissionAmount)}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-2">
          {appointment ? (
            <button className={buttonClass} onClick={() => router.push("/agenda")} type="button">
              Volver a la agenda
            </button>
          ) : (
            <button className={buttonClass} onClick={startOver} type="button">
              Cobrar otro corte
            </button>
          )}
          <button className={`${quietButtonClass} w-full`} onClick={() => router.push("/hoy")} type="button">
            Ver el día
          </button>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        {step > (appointment ? 2 : 1) ? (
          <button
            aria-label="Volver"
            className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 text-[#CBD5E1]"
            onClick={() => setStep(step - 1)}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
        ) : null}
        <ol aria-label={`Paso ${step} de 3`} className="grid flex-1 grid-cols-3 gap-2">
          {stepNames.map((name, index) => (
            <li key={name}>
              <span
                className={`block h-1.5 rounded-full ${index < step ? "bg-[#D97706]" : "bg-white/10"}`}
              />
              <span className={`mt-1.5 block text-xs ${index + 1 === step ? "text-[#F8FAFC]" : "text-[#94A3B8]"}`}>
                {name}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {step === 1 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((item) => (
            <button
              key={item.id}
              className={`${cardClass} flex min-h-20 cursor-pointer items-center justify-between gap-3 px-4 text-left transition hover:border-[#D97706]/60`}
              onClick={() => chooseService(item)}
              type="button"
            >
              <span>
                <span className="block font-medium">{item.name}</span>
                <span className="text-sm text-[#94A3B8]">{item.durationMin} min</span>
              </span>
              <span className="font-semibold tabular-nums">{formatCop(item.listPrice)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <div className={`${cardClass} p-4`}>
            {appointment ? (
              <p className="mb-1 text-sm text-[#BFDBFE]">
                Cita de las {appointment.time} · {appointment.clientName} con {appointment.memberName}
              </p>
            ) : null}
            <p className="font-medium">{service.name}</p>
            <p className="text-sm text-[#94A3B8]">Precio de lista {formatCop(service.listPrice)}</p>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-[#CBD5E1]">Monto cobrado</span>
            <input
              autoFocus
              className={`${inputClass} h-14 text-2xl font-semibold tabular-nums`}
              inputMode="numeric"
              maxLength={8}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
              value={amount}
            />
            <span className="mt-2 block text-sm text-[#94A3B8]">
              {amountOk ? formatCop(parsedAmount) : "Escribe el valor en pesos, sin puntos."}
              {extra ? ` · incluye ${formatCop(extra)} de adicional` : ""}
            </span>
          </label>
          {needsReason ? (
            <label className="block">
              <span className="mb-2 block text-sm text-[#FBBF24]">
                Descuento de {formatCop(service.listPrice - parsedAmount)}. ¿Por qué?
              </span>
              <input
                className={inputClass}
                maxLength={120}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej.: cliente frecuente"
                value={reason}
              />
            </label>
          ) : null}
          <button className={buttonClass} disabled={!canContinue} onClick={() => setStep(3)} type="button">
            Seguir al pago
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-5">
          {!appointment && barbers && barbers.length > 1 ? (
            <div>
              <p className="mb-2 text-sm text-[#CBD5E1]">¿Quién lo atendió?</p>
              <div className="flex flex-wrap gap-2">
                {barbers.map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={memberId === item.id}
                    className={`h-11 cursor-pointer rounded-xl border px-4 text-sm ${
                      memberId === item.id ? "border-[#D97706] bg-[#D97706] font-semibold text-[#0F172A]" : "border-white/10 text-[#CBD5E1]"
                    }`}
                    onClick={() => setMemberId(item.id)}
                    type="button"
                  >
                    {item.id === selfId ? `${item.name} (yo)` : item.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-sm text-[#CBD5E1]">¿Cómo pagó?</p>
            <div className="grid grid-cols-3 gap-2">
              {methods.map((item) => {
                const Icon = item.icon;
                const active = method === item.id;
                return (
                  <button
                    key={item.id}
                    aria-pressed={active}
                    className={`flex h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border text-sm transition ${
                      active
                        ? "border-[#D97706] bg-[#D97706] font-semibold text-[#0F172A]"
                        : "border-white/10 text-[#CBD5E1] hover:border-white/25"
                    }`}
                    onClick={() => setMethod(item.id)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={22} strokeWidth={1.75} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-[#CBD5E1]">Propina</p>
            <div className="grid grid-cols-4 gap-2">
              {tipOptions.map((value) => (
                <button
                  key={value}
                  aria-pressed={tip === String(value)}
                  className={`h-12 cursor-pointer rounded-xl border text-sm tabular-nums ${
                    tip === String(value)
                      ? "border-[#D97706] text-[#FBBF24]"
                      : "border-white/10 text-[#CBD5E1]"
                  }`}
                  onClick={() => setTip(String(value))}
                  type="button"
                >
                  {value === 0 ? "Sin" : formatCop(value).replace(/\s/g, "")}
                </button>
              ))}
            </div>
            <input
              aria-label="Otra propina"
              className={`${inputClass} mt-2 tabular-nums`}
              inputMode="numeric"
              maxLength={8}
              onChange={(event) => setTip(event.target.value.replace(/\D/g, ""))}
              placeholder="Otro valor"
              value={tipOptions.includes(Number(tip)) ? "" : tip}
            />
          </div>
          <div className={`${cardClass} flex items-center justify-between p-4`}>
            <span className="text-sm text-[#CBD5E1]">Total que recibes</span>
            <span className="text-xl font-semibold tabular-nums">
              {formatCop(parsedAmount + (/^\d+$/.test(tip) ? Number(tip) : 0))}
            </span>
          </div>
          {message ? <Notice tone="error">{message}</Notice> : null}
          <button className={buttonClass} disabled={pending} onClick={confirm} type="button">
            {pending ? "Guardando…" : "Confirmar cobro"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
