"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { chargeAction } from "./actions";
import { buttonClass, inputClass } from "@/components/ui";
import { formatCop } from "@/server/money";

type Service = { id: string; name: string; durationMin: number; listPrice: number };

const methods = [
  { id: "cash", label: "Efectivo" },
  { id: "transfer", label: "Transferencia" },
  { id: "card", label: "Tarjeta" },
] as const;

export function CheckoutForm({ services }: { services: Service[] }) {
  const router = useRouter();
  const clientKey = useMemo(() => crypto.randomUUID(), []);
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((item) => item.id === serviceId) ?? services[0];
  const [amount, setAmount] = useState(String(service?.listPrice ?? ""));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<(typeof methods)[number]["id"]>("cash");
  const [tip, setTip] = useState("0");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<{ charged: number; tip: number; commissionAmount: number; serviceName: string } | null>(null);

  if (!service) return null;
  const parsedAmount = /^\d+$/.test(amount) ? Number(amount) : Number.NaN;
  const needsReason = Number.isInteger(parsedAmount) && parsedAmount < service.listPrice;

  function chooseService(next: Service) {
    setServiceId(next.id);
    setAmount(String(next.listPrice));
    setReason("");
    setStep(2);
  }

  async function confirm() {
    setPending(true);
    setMessage("");
    const result = await chargeAction({
      serviceId: service.id,
      amount: parsedAmount,
      reason,
      tip: /^\d+$/.test(tip) ? Number(tip) : Number.NaN,
      paymentMethod: method,
      clientKey,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setReceipt(result.receipt);
    router.refresh();
  }

  if (receipt) {
    return (
      <section className="rounded-2xl bg-[#1E293B] p-6">
        <p className="text-sm text-[#CBD5E1]">{receipt.serviceName}</p>
        <p className="mt-2 text-[32px] font-semibold tabular-nums">{formatCop(receipt.charged)}</p>
        <p className="mt-2 text-[#CBD5E1]">Propina {formatCop(receipt.tip)}</p>
        <p className="text-[#CBD5E1]">Comisión {formatCop(receipt.commissionAmount)}</p>
        <button className={`${buttonClass} mt-6`} onClick={() => router.push("/hoy")} type="button">
          Ver el día
        </button>
      </section>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-[#CBD5E1]">{step} de 3</p>
      {step === 1 ? (
        <div className="flex flex-col gap-3">
          {services.map((item) => (
            <button
              key={item.id}
              className="flex h-16 cursor-pointer items-center justify-between rounded-2xl bg-[#1E293B] px-4 text-left"
              onClick={() => chooseService(item)}
              type="button"
            >
              <span>
                <span className="block font-medium">{item.name}</span>
                <span className="text-sm text-[#CBD5E1]">{item.durationMin} min</span>
              </span>
              <span className="tabular-nums">{formatCop(item.listPrice)}</span>
            </button>
          ))}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#CBD5E1]">
            {service.name} · lista {formatCop(service.listPrice)}
          </p>
          <label className="block">
            <span className="mb-2 block text-sm text-[#CBD5E1]">Monto cobrado</span>
            <input
              className={`${inputClass} tabular-nums`}
              inputMode="numeric"
              onChange={(event) => setAmount(event.target.value)}
              value={amount}
            />
          </label>
          {needsReason ? (
            <label className="block">
              <span className="mb-2 block text-sm text-[#CBD5E1]">Motivo del descuento</span>
              <input className={inputClass} onChange={(event) => setReason(event.target.value)} value={reason} />
            </label>
          ) : null}
          <button className={buttonClass} onClick={() => setStep(3)} type="button">
            Seguir al pago
          </button>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2">
            {methods.map((item) => (
              <button
                key={item.id}
                className={`h-12 cursor-pointer rounded-xl border ${
                  method === item.id ? "border-[#D97706] bg-[#D97706] text-[#0F172A]" : "border-white/10"
                }`}
                onClick={() => setMethod(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-[#CBD5E1]">Propina</span>
            <input
              className={`${inputClass} tabular-nums`}
              inputMode="numeric"
              onChange={(event) => setTip(event.target.value)}
              value={tip}
            />
          </label>
          {message ? <p className="text-sm text-[#FECACA]">{message}</p> : null}
          <button className={buttonClass} disabled={pending} onClick={confirm} type="button">
            {pending ? "Guardando…" : "Confirmar cobro"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
