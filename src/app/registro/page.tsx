"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "./actions";
import { AuthFrame } from "@/components/auth-frame";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, null);
  return (
    <AuthFrame title="Registra tu barbería" detail="En dos minutos estás cobrando tu primer corte.">
      <form action={action} className="mt-8 flex flex-col gap-4">
        <Field label="Tu nombre">
          <input className={inputClass} defaultValue={state?.values.ownerName} name="ownerName" autoComplete="name" maxLength={80} required />
        </Field>
        <Field label="Nombre de la barbería">
          <input className={inputClass} defaultValue={state?.values.shopName} name="shopName" maxLength={80} required />
        </Field>
        <Field label="Correo">
          <input className={inputClass} defaultValue={state?.values.email} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres.">
          <input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3">
          <input className="mt-1 h-5 w-5 accent-[#D97706]" defaultChecked name="takesAppointments" type="checkbox" />
          <span>
            <span className="block text-sm font-medium">Yo también atiendo clientes</span>
            <span className="block text-xs text-[#94A3B8]">
              Tendrás agenda propia de lunes a sábado, de 9:00 a 19:00. La cambias después en Horarios.
            </span>
          </span>
        </label>
        {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Creando…" : "Crear barbería"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[#CBD5E1]">
        ¿Ya tienes cuenta?{" "}
        <Link className="text-[#D97706]" href="/entrar">
          Entra
        </Link>
      </p>
    </AuthFrame>
  );
}
