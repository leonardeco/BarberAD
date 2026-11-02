import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { buttonClass } from "@/components/ui";
import { resetTokenIsValid } from "@/server/auth";
import { tokenHash } from "@/server/token";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Contraseña nueva" };

export default async function NewPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[A-Za-z0-9_-]{20,100}$/.test(token) && (await resetTokenIsValid(tokenHash(token)));
  if (!valid) {
    return (
      <AuthFrame title="Este enlace ya no sirve" detail="Venció o ya se usó. Pide uno nuevo, tarda un minuto.">
        <Link className={`${buttonClass} mt-8`} href="/recuperar">
          Pedir otro enlace
        </Link>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title="Crea tu contraseña nueva" detail="Al guardarla se cierra la sesión en todos tus dispositivos.">
      <NewPasswordForm token={token} />
    </AuthFrame>
  );
}
