import type { ReactNode } from "react";

export const inputClass =
  "h-12 w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 text-base text-[#F8FAFC]";

export const buttonClass =
  "inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-[#D97706] px-4 text-base font-semibold text-[#0F172A] transition motion-safe:active:scale-[0.98] disabled:cursor-wait disabled:opacity-50";

export const quietButtonClass =
  "inline-flex h-12 cursor-pointer items-center justify-center rounded-xl border border-white/10 px-4 text-sm text-[#CBD5E1]";

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#CBD5E1]">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm text-[#FECACA]">{error}</span> : null}
    </label>
  );
}

export function PageTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {detail ? <p className="mt-1 text-sm text-[#CBD5E1]">{detail}</p> : null}
    </header>
  );
}
