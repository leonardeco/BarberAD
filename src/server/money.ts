import { ShopError } from "./errors";

export function readPesos(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return Number.NaN;
  return Number(text);
}

export function wholePesos(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ShopError(`${label} debe ser un número entero de pesos.`);
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
