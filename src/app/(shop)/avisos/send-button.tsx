"use client";

import { useState, useTransition } from "react";
import { Check, MessageCircle } from "lucide-react";
import type { ReminderKind } from "@/server/reminders";
import { markSentAction } from "./actions";

// Abre WhatsApp con el mensaje escrito y lo anota como enviado. El enlace se abre primero, en el mismo toque,
// para que el celular no lo bloquee.
export function SendButton({ kind, id, url }: { kind: ReminderKind; id: string; url: string }) {
  const [sent, setSent] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <a
      className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
        sent ? "bg-[#14532D]/60 text-[#BBF7D0]" : "bg-[#16A34A] text-[#F8FAFC] hover:bg-[#15803D]"
      }`}
      href={url}
      onClick={() => {
        setSent(true);
        startTransition(() => markSentAction(kind, id));
      }}
      rel="noreferrer"
      target="_blank"
    >
      {sent ? <Check aria-hidden="true" size={16} /> : <MessageCircle aria-hidden="true" size={16} />}
      {sent ? "Enviado" : "Enviar"}
    </a>
  );
}
