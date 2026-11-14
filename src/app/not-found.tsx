import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "No encontrada" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Logo size={36} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Esta página no existe</h1>
        <p className="mt-2 text-[#CBD5E1]">El enlace está mal escrito o ya no sirve.</p>
      </div>
      <Link className={buttonClass} href="/hoy">
        Ir al inicio
      </Link>
    </main>
  );
}
