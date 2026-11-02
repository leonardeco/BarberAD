"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Plus, Scissors, Users, Wallet } from "lucide-react";
import { endSessionAction } from "@/app/session-action";

const links = [
  { href: "/hoy", label: "Hoy", icon: CalendarDays, ownerOnly: false },
  { href: "/cobrar", label: "Cobrar", icon: Plus, ownerOnly: false },
  { href: "/servicios", label: "Servicios", icon: Scissors, ownerOnly: true },
  { href: "/equipo", label: "Equipo", icon: Users, ownerOnly: true },
  { href: "/caja", label: "Caja", icon: Wallet, ownerOnly: true },
];

export function Shell({
  shopName,
  personName,
  role,
  children,
}: {
  shopName: string;
  personName: string;
  role: "owner" | "barber";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = links.filter((item) => role === "owner" || !item.ownerOnly);

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-white/10 bg-[#1E293B] px-4 py-6 lg:flex">
        <p className="px-3 text-xs uppercase tracking-wide text-[#CBD5E1]">Barbería</p>
        <p className="mt-1 px-3 text-lg font-semibold">{shopName}</p>
        <nav className="mt-8 flex flex-col gap-2">
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} wide />
          ))}
        </nav>
      </aside>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5">
        <div>
          <p className="text-sm text-[#CBD5E1]">{shopName}</p>
          <p className="font-medium">{personName}</p>
        </div>
        <form action={endSessionAction}>
          <button className="h-12 cursor-pointer rounded-xl px-3 text-sm text-[#CBD5E1]" type="submit">
            Salir
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 lg:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-white/10 bg-[#0F172A]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {items.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}
      </nav>
    </div>
  );
}

function NavLink({
  item,
  active,
  wide,
}: {
  item: (typeof links)[number];
  active: boolean;
  wide?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl text-sm ${
        wide ? "h-12 px-3" : "min-h-12 flex-1 flex-col gap-1 text-xs"
      } ${active ? "bg-[#D97706] text-[#0F172A]" : "text-[#CBD5E1]"}`}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}
