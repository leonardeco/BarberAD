import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/">
        <Logo size={32} />
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-[#94A3B8]">Última actualización: {updated}</p>
      <div className="legal mt-8 flex flex-col gap-4 text-[#CBD5E1] [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[#F8FAFC] [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-[#F8FAFC]">
        {children}
      </div>
    </main>
  );
}
