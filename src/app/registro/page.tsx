"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "./actions";
import { AuthFrame } from "@/components/auth-frame";
import { Field, buttonClass, inputClass } from "@/components/ui";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, null);
  return (
    <AuthFrame title="Registra tu barbería" detail="En dos minutos estás cobrando tu primer corte.">
      <form action={action} className="mt-8 flex flex-col gap-4">
        <Field label="Tu nombre">
          <input className={inputClass} name="ownerName" autoComplete="name" required />
        </Field>
        <Field label="Nombre de la barbería">
          <input className={inputClass} name="shopName" required />
        </Field>
        <Field label="Correo">
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres.">
          <input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        {state?.message ? <p className="text-sm text-[#FECACA]">{state.message}</p> : null}
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
