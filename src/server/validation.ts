import { ShopError } from "./errors";

export const MAX_PASSWORD = 200;

export function cleanName(value: string, label: string, max = 80) {
  const text = value.trim();
  if (!text) throw new ShopError(`Escribe ${label}.`);
  if (text.length > max) throw new ShopError(`${label[0].toUpperCase()}${label.slice(1)} es demasiado largo (máximo ${max} caracteres).`);
  return text;
}

export function cleanEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ShopError("Escribe un correo válido.");
  }
  return email;
}

export function checkPassword(password: string) {
  if (password.length < 8) {
    throw new ShopError("La contraseña debe tener al menos 8 caracteres.");
  }
  if (password.length > MAX_PASSWORD) {
    throw new ShopError(`La contraseña no puede pasar de ${MAX_PASSWORD} caracteres.`);
  }
}

export function checkCommission(percent: number) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new ShopError("La comisión debe estar entre 0 y 100.");
  }
}

export function checkDuration(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
    throw new ShopError("La duración debe estar entre 1 y 480 minutos.");
  }
}
