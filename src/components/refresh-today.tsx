"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RefreshToday() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
