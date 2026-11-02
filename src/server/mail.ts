export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function sendPasswordReset(email: string, link: string) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[BarberAD] Enlace para restablecer la contraseña de ${email}: ${link}`);
    return;
  }
  console.warn("[BarberAD] No hay un servicio de correo configurado; el enlace de recuperación no se envió.");
}
