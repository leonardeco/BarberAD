import { redirect } from "next/navigation";
import { getShopContext } from "@/server/session";

export default async function HomePage() {
  const ctx = await getShopContext();
  redirect(ctx ? "/hoy" : "/entrar");
}
