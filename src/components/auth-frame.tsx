import type { ReactNode } from "react";
import { Banknote, Scissors, Wallet } from "lucide-react";
import { Logo } from "./logo";

const points = [
  { icon: Scissors, text: "Cobras un corte en tres toques, de pie junto a la silla." },
  { icon: Banknote, text: "La comisión de cada barbero sale sola, sin cuentas a mano." },
  { icon: Wallet, text: "Cierras la caja sabiendo cuánto efectivo debe haber." },
];

export function AuthFrame({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-[#1E293B] p-12 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full opacity-[0.08]"
          style={{
            background: "repeating-linear-gradient(135deg, #D97706 0 18px, transparent 18px 36px)",
          }}
        />
        <Logo />
        <div className="relative">
          <p className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Del sillón a la caja, sin cuaderno.
          </p>
          <ul className="mt-8 flex max-w-md flex-col gap-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-[#CBD5E1]">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D97706]/15 text-[#D97706]">
                  <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-[#CBD5E1]">Hecho para barberías en Colombia.</p>
      </aside>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="lg:hidden">
          <Logo size={36} />
        </div>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight lg:mt-0">{title}</h1>
        {detail ? <p className="mt-2 text-[#CBD5E1]">{detail}</p> : null}
        {children}
      </main>
    </div>
  );
}
