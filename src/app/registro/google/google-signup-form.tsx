"use client";

import { useActionState } from "react";
import { completeGoogleSignupAction } from "../actions";
import { AuthFrame } from "@/components/auth-frame";
import { Legal } from "@/components/auth-extras";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";

export function GoogleSignupForm({ email, name }: { email: string; name: string }) {
  const [state, action, pending] = useActionState(completeGoogleSignupAction, null);
  return (
    <AuthFrame title="Ya casi" detail={`Entrarás con Google como ${email}. Solo faltan los datos de tu barbería.`}>
      <form action={action} className="mt-8 flex flex-col gap-4">
        <Field label="Tu nombre">
          <input autoComplete="name" className={inputClass} defaultValue={name} maxLength={80} name="ownerName" required />
        </Field>
        <Field label="Nombre de la barbería">
          <input className={inputClass} maxLength={80} name="shopName" required />
        </Field>
        <Field label="WhatsApp de la barbería" hint="Tus clientes lo ven en tu página de reservas.">
          <input autoComplete="tel" className={inputClass} inputMode="tel" maxLength={20} name="phone" placeholder="300 123 4567" required type="tel" />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3">
          <input className="mt-1 h-5 w-5 accent-[#D97706]" defaultChecked name="takesAppointments" type="checkbox" />
          <span>
            <span className="block text-sm font-medium">Yo también atiendo clientes</span>
            <span className="block text-xs text-[#94A3B8]">Tendrás agenda propia de lunes a sábado, de 9:00 a 19:00.</span>
          </span>
        </label>
        {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Creando…" : "Crear mi barbería gratis"}
        </button>
        <Legal />
      </form>
    </AuthFrame>
  );
}
