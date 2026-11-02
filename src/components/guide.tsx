import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { hideGuideAction } from "@/app/(shop)/hoy/actions";
import type { GuideStep } from "@/server/shop";
import { cardClass } from "./ui";

export function Guide({ steps, done }: { steps: GuideStep[]; done: number }) {
  const next = steps.find((step) => !step.done);
  return (
    <section aria-labelledby="guide-title" className={`${cardClass} mb-6 border-[#D97706]/30 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold" id="guide-title">
            Deja lista tu barbería
          </h2>
          <p className="text-sm text-[#CBD5E1]">
            {done} de {steps.length} pasos
          </p>
        </div>
        <form action={hideGuideAction}>
          <button className="h-12 cursor-pointer px-2 text-sm text-[#94A3B8] hover:text-[#F8FAFC]" type="submit">
            Ocultar
          </button>
        </form>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#0F172A]">
        <div className="h-full rounded-full bg-[#D97706]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 transition ${
                step.id === next?.id ? "bg-[#D97706]/10 hover:bg-[#D97706]/15" : "hover:bg-white/5"
              }`}
              href={step.href}
            >
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                  step.done
                    ? "border-[#16A34A] bg-[#16A34A] text-[#0F172A]"
                    : step.id === next?.id
                      ? "border-[#D97706] text-[#FBBF24]"
                      : "border-white/20 text-[#94A3B8]"
                }`}
              >
                {step.done ? <Check aria-hidden="true" size={14} strokeWidth={3} /> : steps.indexOf(step) + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${step.done ? "text-[#94A3B8] line-through" : ""}`}>
                  {step.title}
                </span>
                {step.done ? null : <span className="block text-xs text-[#94A3B8]">{step.detail}</span>}
              </span>
              {step.done ? null : <ChevronRight aria-hidden="true" className="text-[#94A3B8]" size={18} />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
