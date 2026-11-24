// Planes. Los límites del plan Gratis también viven en db/migrations/0009_producto.sql: cámbialos en los dos lados.
export const FREE_LIMITS = { barbers: 2, onlineBookingsPerMonth: 50 };

// Precio del plan Pro en pesos por mes. Se puede cambiar sin tocar código con PLAN_PRO_PRICE.
export function proPrice() {
  const value = Number(process.env.PLAN_PRO_PRICE ?? 20000);
  return Number.isInteger(value) && value > 0 ? value : 20000;
}

export const proOptions = [
  { months: 1, label: "1 mes", discount: 0 },
  { months: 6, label: "6 meses", discount: 10 },
  { months: 12, label: "12 meses", discount: 20 },
] as const;

export function proTotal(months: number) {
  const option = proOptions.find((item) => item.months === months);
  if (!option) return null;
  return Math.round((proPrice() * months * (100 - option.discount)) / 100);
}
