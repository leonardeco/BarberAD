"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, BarChart3, BellRing, CalendarClock, HandCoins, CalendarDays, Clock, Contact, LogOut, Menu, Plus, Scissors, Users, Wallet } from "lucide-react";
import { endSessionAction } from "@/app/session-action";
import { Logo, LogoMark } from "./logo";

type NavLink = { href: string; label: string; icon: typeof CalendarDays; ownerOnly: boolean; mobile: "owner" | "barber" | "both" | "none" };

const links: NavLink[] = [
  { href: "/hoy", label: "Hoy", icon: CalendarDays, ownerOnly: false, mobile: "both" },
  { href: "/agenda", label: "Agenda", icon: CalendarClock, ownerOnly: false, mobile: "both" },
  { href: "/cobrar", label: "Cobrar", icon: Plus, ownerOnly: false, mobile: "both" },
  { href: "/avisos", label: "Avisos", icon: BellRing, ownerOnly: false, mobile: "barber" },
  { href: "/clientes", label: "Clientes", icon: Contact, ownerOnly: false, mobile: "barber" },
  { href: "/caja", label: "Caja", icon: Wallet, ownerOnly: true, mobile: "owner" },
  { href: "/reportes", label: "Reportes", icon: BarChart3, ownerOnly: true, mobile: "none" },
  { href: "/liquidar", label: "Liquidar", icon: HandCoins, ownerOnly: true, mobile: "none" },
  { href: "/servicios", label: "Servicios", icon: Scissors, ownerOnly: true, mobile: "none" },
  { href: "/equipo", label: "Equipo", icon: Users, ownerOnly: true, mobile: "none" },
  { href: "/horarios", label: "Horarios", icon: Clock, ownerOnly: true, mobile: "none" },
  { href: "/plan", label: "Plan", icon: Crown, ownerOnly: true, mobile: "none" },
  { href: "/mas", label: "Más", icon: Menu, ownerOnly: true, mobile: "owner" },
];

type Item = (typeof links)[number];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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
  const items = links.filter((item) => (role === "owner" || !item.ownerOnly) && item.href !== "/mas");
  const mobileItems = links.filter((item) => item.mobile === "both" || item.mobile === role);
  const roleLabel = role === "owner" ? "Dueño" : "Barbero";

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/10 bg-[#1E293B] px-4 py-6 lg:flex">
        <div className="px-3">
          <Logo size={36} />
        </div>
        <div className="mt-6 rounded-xl bg-[#0F172A]/60 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-[#94A3B8]">Barbería</p>
          <p className="mt-0.5 truncate font-semibold">{shopName}</p>
        </div>
        <nav aria-label="Principal" className="mt-6 flex flex-col gap-1">
          {items.map((item) => (
            <SideLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
          <Link
            className={`flex h-14 items-center gap-3 rounded-xl px-3 ${
              pathname === "/cuenta" ? "bg-white/5" : "hover:bg-white/5"
            }`}
            href="/cuenta"
          >
            <Avatar name={personName} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{personName}</span>
              <span className="block text-xs text-[#94A3B8]">{roleLabel} · Mi cuenta</span>
            </span>
          </Link>
          <form action={endSessionAction}>
            <button
              className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-[#CBD5E1] hover:bg-white/5"
              type="submit"
            >
              <LogOut aria-hidden="true" size={18} strokeWidth={1.75} />
              Salir
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0F172A]/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark size={32} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{shopName}</p>
              <p className="truncate text-xs text-[#94A3B8]">{personName}</p>
            </div>
          </div>
          <Link aria-label="Mi cuenta" className="inline-flex h-12 w-12 items-center justify-center" href="/cuenta">
            <Avatar name={personName} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 lg:max-w-4xl lg:px-8 lg:pb-12 lg:pt-10">{children}</main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 flex items-end border-t border-white/10 bg-[#0F172A]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
      >
        {mobileItems.map((item) => (
          <BottomLink key={item.href} item={item} active={pathname === item.href} />
        ))}
      </nav>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D97706]/20 text-sm font-semibold text-[#FBBF24]">
      {initials(name)}
    </span>
  );
}

function SideLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      aria-current={active ? "page" : undefined}
      href={item.href}
      className={`flex h-12 items-center gap-3 rounded-xl px-3 text-sm transition ${
        active ? "bg-[#D97706] font-semibold text-[#0F172A]" : "text-[#CBD5E1] hover:bg-white/5 hover:text-[#F8FAFC]"
      }`}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}

function BottomLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  if (item.href === "/cobrar") {
    return (
      <Link
        aria-current={active ? "page" : undefined}
        href={item.href}
        className="flex flex-1 flex-col items-center gap-1 text-xs font-semibold text-[#F8FAFC]"
      >
        <span className="-mt-7 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#D97706] text-[#0F172A] shadow-lg shadow-black/40 ring-4 ring-[#0F172A]">
          <Icon aria-hidden="true" size={26} strokeWidth={2.25} />
        </span>
        {item.label}
      </Link>
    );
  }
  return (
    <Link
      aria-current={active ? "page" : undefined}
      href={item.href}
      className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-xs ${
        active ? "font-semibold text-[#FBBF24]" : "text-[#CBD5E1]"
      }`}
    >
      <Icon aria-hidden="true" size={22} strokeWidth={active ? 2.25 : 1.75} />
      {item.label}
    </Link>
  );
}
