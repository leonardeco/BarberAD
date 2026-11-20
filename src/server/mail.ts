export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

// Envía con Resend (https://resend.com) si hay RESEND_API_KEY. Sin ella, en local el enlace sale en la consola.
export async function sendPasswordReset(email: string, link: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[BarberAD] Enlace para restablecer la contraseña de ${email}: ${link}`);
    } else {
      console.warn("[BarberAD] Falta RESEND_API_KEY: el enlace de recuperación no se envió.");
    }
    return;
  }
  const from = process.env.MAIL_FROM?.trim() || "BarberAD <onboarding@resend.dev>";
  const text = `Hola:\n\nPara crear una contraseña nueva en BarberAD, abre este enlace:\n${link}\n\nVence en 30 minutos y sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña sigue igual.`;
  const html = `<p>Hola:</p><p>Para crear una contraseña nueva en BarberAD, toca el botón:</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#D97706;color:#0F172A;border-radius:10px;text-decoration:none;font-weight:600">Crear contraseña nueva</a></p>
<p style="color:#64748B">Vence en 30 minutos y sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña sigue igual.</p>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: "Crea tu contraseña nueva en BarberAD", text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`[BarberAD] Resend respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
  } catch (error) {
    // La respuesta al usuario es la misma pase lo que pase; el fallo queda en el registro.
    console.error("[BarberAD] No se pudo enviar el correo de recuperación:", error);
  }
}
