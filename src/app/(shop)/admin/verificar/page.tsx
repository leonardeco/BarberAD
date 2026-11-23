import { notFound, redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { adminState } from "@/server/admin";
import { getShopContext } from "@/server/session";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Administrador" };

export default async function AdminVerifyPage() {
  const ctx = await getShopContext();
  if (!ctx) redirect("/salir");
  const state = await adminState(ctx);
  if (state === "no") notFound();
  if (state === "ok") redirect("/admin");
  return (
    <>
      <PageTitle title="Panel de administrador" detail="Por seguridad, confirma que eres tú con un código de 4 números." />
      <VerifyForm />
    </>
  );
}
