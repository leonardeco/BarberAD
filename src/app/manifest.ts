import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BarberAD",
    short_name: "BarberAD",
    description: "Cobro de cortes, comisiones y caja para tu barbería.",
    lang: "es-CO",
    start_url: "/hoy",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#0F172A",
    icons: [{ src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
