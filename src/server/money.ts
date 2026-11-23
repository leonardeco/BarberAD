import { ShopError } from "./errors";

// Tope por cobro, precio o propina. Además de evitar errores de dedo, deja el
// cálculo de la comisión de Postgres (entero × porcentaje) lejos del desborde.
export const MAX_PESOS = 10_000_000;
// Tope del efectivo contado al cerrar: es una suma del día, no un cobro.
export const MAX_DRAWER_PESOS = 1_000_000_000;

export function readPesos(value: FormDataEntryValue | null) {
  return readInt(value);
}

// Solo dígitos. Un campo vacío o con texto da NaN, no 0.
export function readInt(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,15}$/.test(text)) return Number.NaN;
  return Number(text);
}

export function wholePesos(value: number, label: string, max = MAX_PESOS) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ShopError(`${label} debe ser un número entero de pesos.`);
  }
  if (value > max) {
    throw new ShopError(`${label} no puede pasar de ${formatCop(max)}.`);
  }
  return value;
}

export function deriveMoney(listPrice: number, amount: number, reason: string) {
  wholePesos(listPrice, "El precio");
  wholePesos(amount, "El monto");
  if (amount >= listPrice) {
    return {
      listPrice,
      extras: amount - listPrice,
      discount: 0,
      discountReason: "",
      charged: amount,
    };
  }
  const discountReason = reason.trim();
  if (!discountReason) {
    throw new ShopError("Si cobras menos del precio de lista, escribe el motivo.");
  }
  if (discountReason.length > 120) {
    throw new ShopError("El motivo del descuento es demasiado largo (máximo 120 caracteres).");
  }
  return {
    listPrice,
    extras: 0,
    discount: listPrice - amount,
    discountReason,
    charged: amount,
  };
}

export function commissionAmount(charged: number, percent: number) {
  return Math.floor((charged * percent) / 100);
}

export function formatCop(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}
