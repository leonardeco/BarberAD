import { createHash, randomBytes } from "node:crypto";
import { required } from "./env";

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string) {
  return createHash("sha256").update(`${required("SESSION_SECRET")}:${token}`).digest("hex");
}
