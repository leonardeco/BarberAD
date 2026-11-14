"use client";

import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Logo size={36} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Algo salió mal</h1>
        <p className="mt-2 text-[#CBD5E1]">
          No pudimos cargar esta pantalla. Tus cobros anteriores están a salvo. Inténtalo otra vez.
        </p>
        {error.digest ? <p className="mt-2 text-xs text-[#94A3B8]">Código: {error.digest}</p> : null}
      </div>
      <button className={buttonClass} onClick={reset} type="button">
        Intentar de nuevo
      </button>
    </main>
  );
}
