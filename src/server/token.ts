import { createHash, randomBytes } from "node:crypto";
import { required } from "./env";

const exampleSecret = "cambia-esta-clave-local";

// En producción no se arranca con el secreto de ejemplo ni con uno corto.
export function sessionSecret() {
  const secret = required("SESSION_SECRET");
  if (process.env.NODE_ENV === "production" && (secret === exampleSecret || secret.length < 32)) {
    throw new Error(
      "SESSION_SECRET no es seguro para producción: define uno propio de al menos 32 caracteres (por ejemplo, con `openssl rand -base64 48`).",
    );
  }
  return secret;
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string) {
  return createHash("sha256").update(`${sessionSecret()}:${token}`).digest("hex");
}
