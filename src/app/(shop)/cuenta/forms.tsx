"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "./actions";
import { Field, Notice, buttonClass, cardClass, inputClass } from "@/components/ui";
import type { ShopProfile } from "@/server/shop";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4 p-4`}>
      <h2 className="font-semibold">Cambiar contraseña</h2>
      <Field label="Contraseña actual">
        <input autoComplete="current-password" className={inputClass} name="current" required type="password" />
      </Field>
      <Field hint="Mínimo 8 caracteres." label="Contraseña nueva">
        <input autoComplete="new-password" className={inputClass} minLength={8} name="next" required type="password" />
      </Field>
      <Field label="Repite la contraseña nueva">
        <input autoComplete="new-password" className={inputClass} minLength={8} name="confirm" required type="password" />
      </Field>
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}

export function ProfileForm({ profile }: { profile: ShopProfile }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4 p-4`}>
      <h2 className="font-semibold">Datos de la barbería</h2>
      <Field label="Nombre">
        <input className={inputClass} defaultValue={profile.name} name="name" required />
      </Field>
      <Field label="Teléfono o WhatsApp">
        <input
          autoComplete="tel"
          className={inputClass}
          defaultValue={profile.phone}
          inputMode="tel"
          name="phone"
          placeholder="300 123 4567"
        />
      </Field>
      <Field label="Dirección">
        <input
          autoComplete="street-address"
          className={inputClass}
          defaultValue={profile.address}
          name="address"
          placeholder="Calle 10 # 5-20, Bogotá"
        />
      </Field>
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar datos"}
      </button>
    </form>
  );
}
