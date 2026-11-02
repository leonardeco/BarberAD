import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getShopContext } from "@/server/session";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getShopContext();
  if (!ctx) redirect("/entrar");
  return (
    <Shell personName={ctx.displayName} role={ctx.role} shopName={ctx.shopName}>
      {children}
    </Shell>
  );
}
