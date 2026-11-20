// Datos del responsable que aparecen en los Términos y en la Política de datos. Defínelos antes de publicar.
export function legalEntity() {
  return {
    name: process.env.LEGAL_NAME?.trim() || "[Nombre o razón social del responsable]",
    id: process.env.LEGAL_ID?.trim() || "[NIT o cédula]",
    email: process.env.LEGAL_EMAIL?.trim() || "[correo de contacto para datos personales]",
    address: process.env.LEGAL_ADDRESS?.trim() || "[dirección de notificaciones]",
    city: process.env.LEGAL_CITY?.trim() || "[ciudad]",
    updated: process.env.LEGAL_UPDATED?.trim() || "20 de noviembre de 2026",
  };
}

export function legalComplete() {
  return Boolean(process.env.LEGAL_NAME && process.env.LEGAL_ID && process.env.LEGAL_EMAIL && process.env.LEGAL_ADDRESS);
}
