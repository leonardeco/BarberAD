import type { ReactNode } from "react";

export const inputClass =
  "h-12 w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 text-base text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#D97706]";

export const buttonClass =
  "inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#D97706] px-4 text-base font-semibold text-[#0F172A] transition hover:bg-[#F59E0B] motion-safe:active:scale-[0.98] disabled:cursor-wait disabled:opacity-50";

export const quietButtonClass =
  "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-[#CBD5E1] transition hover:border-white/25 hover:text-[#F8FAFC]";

export const cardClass = "rounded-2xl border border-white/5 bg-[#1E293B]";

export function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#CBD5E1]">{label}</span>
      {children}
      {hint && !error ? <span className="mt-2 block text-xs text-[#94A3B8]">{hint}</span> : null}
      {error ? <span className="mt-2 block text-sm text-[#FECACA]">{error}</span> : null}
    </label>
  );
}

export function PageTitle({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {detail ? <p className="mt-1 text-sm text-[#CBD5E1]">{detail}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <article className={`${cardClass} p-4`}>
      <p className="text-sm text-[#CBD5E1]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[#94A3B8]">{detail}</p> : null}
    </article>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <p
      className={`rounded-xl px-4 py-3 text-sm ${
        tone === "ok" ? "bg-[#14532D]/40 text-[#BBF7D0]" : "bg-[#7F1D1D]/40 text-[#FECACA]"
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function EmptyState({
  icon,
  title,
  detail,
  children,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#D97706]/15 text-[#D97706]">
        {icon}
      </span>
      <p className="mt-4 font-medium">{title}</p>
      {detail ? <p className="mt-1 max-w-sm text-sm text-[#CBD5E1]">{detail}</p> : null}
      {children ? <div className="mt-5 w-full max-w-xs">{children}</div> : null}
    </div>
  );
}
