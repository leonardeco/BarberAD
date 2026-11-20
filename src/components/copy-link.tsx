"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cardClass, quietButtonClass } from "./ui";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia tu enlace:", url);
    }
  }
  return (
    <section className={`${cardClass} border-[#D97706]/30 p-4`}>
      <h2 className="font-semibold">Tu enlace de reservas</h2>
      <p className="text-sm text-[#CBD5E1]">Ponlo en tu Instagram y en el estado de WhatsApp. Tus clientes reservan solos.</p>
      <p className="mt-3 truncate rounded-xl bg-[#0F172A] px-3 py-2 font-mono text-sm text-[#FBBF24]">{url}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className={quietButtonClass} onClick={copy} type="button">
          {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
        <a className={quietButtonClass} href={url} rel="noreferrer" target="_blank">
          <ExternalLink aria-hidden="true" size={16} /> Ver
        </a>
      </div>
    </section>
  );
}
