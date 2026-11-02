import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "BarberAD", template: "%s · BarberAD" },
  description: "Cobro de cortes, comisiones y caja para tu barbería.",
  appleWebApp: { capable: true, title: "BarberAD", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
