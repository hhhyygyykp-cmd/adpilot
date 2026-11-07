"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { useSession } from "./providers";

export function ChatThread({
  messages,
  onSend,
  onSkip,
  onSkipRemaining,
  disabled,
  showSkip,
  showSkipRemaining,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  onSkip?: () => Promise<void>;
  onSkipRemaining?: () => Promise<void>;
  disabled?: boolean;
  showSkip?: boolean;
  showSkipRemaining?: boolean;
}) {
  const { t } = useSession();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel grain overflow-hidden rounded-3xl">
      <div className="max-h-[52vh] space-y-3 overflow-y-auto p-5 md:p-7">
        {messages.map((item) => (
          <div
            key={item.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
              item.role === "agent"
                ? "bg-[var(--surface-2)] text-[var(--cream)]"
                : "ms-auto bg-[var(--gold)] text-[var(--ink)]"
            }`}
          >
            {item.text}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="border-t border-[var(--line)] p-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("create.placeholder")}
          rows={3}
          disabled={disabled || busy}
          className="w-full resize-none rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none focus:border-[var(--gold)]"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {showSkip && onSkip ? (
              <button
                type="button"
                disabled={busy || disabled}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSkip();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-full px-4 py-2 text-sm text-[var(--muted)]"
              >
                {t("create.skip")}
              </button>
            ) : null}
            {showSkipRemaining && onSkipRemaining ? (
              <button
                type="button"
                disabled={busy || disabled}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSkipRemaining();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-full px-4 py-2 text-sm text-[var(--muted)]"
              >
                {t("business.skipRemaining")}
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={busy || disabled || !text.trim()}
            className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
          >
            {t("create.send")}
          </button>
        </div>
      </form>
    </div>
  );
}
