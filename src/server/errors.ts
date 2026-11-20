export class ShopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopError";
  }
}

export function messageFromDatabase(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const text = error instanceof Error ? error.message : "";
  if (text.includes("checkout_immutable")) return "Ese cobro ya quedó registrado y no se puede modificar.";
  if (text.includes("drawer_closed")) return "La caja de hoy ya está cerrada.";
  if (text.includes("invalid_name")) return "Escribe el nombre.";
  if (text.includes("invalid_commission")) return "La comisión debe estar entre 0 y 100.";
  if (text.includes("slot_taken") || code === "23P01") return "Esa hora se acaba de ocupar. Elige otra.";
  if (text.includes("too_many_bookings")) return "Ya tienes 3 citas pendientes en esta barbería.";
  if (text.includes("service_unavailable")) return "Ese servicio ya no está disponible.";
  if (text.includes("invalid_phone")) return "Escribe un número de WhatsApp válido.";
  if (text.includes("shop_not_found")) return "No encontramos esa barbería.";
  if (text.includes("forbidden")) return "No tienes permiso para hacer eso.";
  if (code === "22003") return "Ese valor es demasiado grande.";
  if (code === "23505" && text.includes("users_email")) return "Ese correo ya está registrado.";
  if (code === "23505") return "Ese dato ya existe.";
  return null;
}
