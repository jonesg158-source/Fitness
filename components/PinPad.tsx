"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** If true, require the user to enter the PIN twice. */
  confirm?: boolean;
  busy?: boolean;
  error?: string | null;
  /** Called with the final PIN once entry (and confirmation) is complete. */
  onSubmit: (pin: string) => void | Promise<void>;
};

const MIN = 4;
const MAX = 6;

export function PinPad({
  title,
  subtitle,
  confirm,
  busy,
  error,
  onSubmit,
}: Props) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLocalError(null);
  }, [pin, confirmPin]);

  const active = stage === "enter" ? pin : confirmPin;

  const push = useCallback(
    (d: string) => {
      if (busy) return;
      if (active.length >= MAX) return;
      if (stage === "enter") setPin((p) => p + d);
      else setConfirmPin((p) => p + d);
    },
    [busy, active.length, stage],
  );

  const del = useCallback(() => {
    if (busy) return;
    if (stage === "enter") setPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
  }, [busy, stage]);

  const submit = useCallback(async () => {
    if (busy) return;
    if (active.length < MIN) {
      setLocalError(`PIN must be at least ${MIN} digits`);
      return;
    }
    if (confirm && stage === "enter") {
      setStage("confirm");
      return;
    }
    if (confirm && stage === "confirm") {
      if (pin !== confirmPin) {
        setLocalError("PINs don't match");
        setConfirmPin("");
        setStage("enter");
        setPin("");
        return;
      }
    }
    await onSubmit(pin);
  }, [busy, active.length, confirm, stage, pin, confirmPin, onSubmit]);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 pb-safe">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle ? (
        <p className="mt-2 text-center text-sm opacity-70 max-w-xs">
          {subtitle}
        </p>
      ) : null}

      <div className="mt-8 flex gap-3">
        {Array.from({ length: MAX }).map((_, i) => {
          const filled = i < active.length;
          return (
            <div
              key={i}
              className={[
                "h-4 w-4 rounded-full border",
                filled
                  ? "bg-brand-600 border-brand-600"
                  : "border-slate-300 dark:border-slate-600",
              ].join(" ")}
              aria-hidden
            />
          );
        })}
      </div>

      <div className="mt-3 h-5 text-sm text-red-500">
        {error ?? localError ?? (busy ? "Working…" : " ")}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <PadButton key={d} onClick={() => push(d)} disabled={busy}>
            {d}
          </PadButton>
        ))}
        <PadButton onClick={del} disabled={busy} aria-label="Delete">
          ⌫
        </PadButton>
        <PadButton onClick={() => push("0")} disabled={busy}>
          0
        </PadButton>
        <PadButton onClick={submit} disabled={busy} primary>
          {confirm && stage === "enter" ? "Next" : "OK"}
        </PadButton>
      </div>
    </div>
  );
}

function PadButton({
  children,
  onClick,
  disabled,
  primary,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-16 w-16 rounded-full text-2xl font-semibold select-none",
        "transition active:scale-95 disabled:opacity-40",
        primary
          ? "bg-brand-600 text-white"
          : "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
