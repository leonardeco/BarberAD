import { redirect } from "next/navigation";
import { getShopContext } from "@/server/session";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  if (ctx.role !== "owner") redirect("/hoy");
  return children;
}
