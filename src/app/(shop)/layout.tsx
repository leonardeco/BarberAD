import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { adminState } from "@/server/admin";
import { getShopContext } from "@/server/session";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const admin = (await adminState(ctx)) !== "no";
  return (
    <Shell admin={admin} personName={ctx.displayName} role={ctx.role} shopName={ctx.shopName}>
      {children}
    </Shell>
  );
}
