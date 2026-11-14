"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RefreshToday() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    // Con la pantalla apagada o en otra pestaña no se consulta; al volver, se pone al día.
    const timer = window.setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
