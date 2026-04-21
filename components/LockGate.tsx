"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db/schema";
import {
  createWrappedDek,
  rewrapDek,
  unwrapDek,
  type WrappedDek,
} from "@/lib/crypto/pin";
import { CryptoCtx, type CryptoSession } from "@/lib/crypto/session";
import { PinPad } from "@/components/PinPad";

const WRAPPED_DEK_KEY = "wrappedDek";
const IDLE_LOCK_MS = 10 * 60 * 1000;

async function readWrapped(): Promise<WrappedDek | null> {
  const row = await db.kv.get(WRAPPED_DEK_KEY);
  return (row?.value as WrappedDek | undefined) ?? null;
}

async function writeWrapped(w: WrappedDek): Promise<void> {
  await db.kv.put({ key: WRAPPED_DEK_KEY, value: w, updatedAt: Date.now() });
}

type Phase = "loading" | "setup" | "locked" | "unlocked";

export function LockGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastActivity = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    readWrapped()
      .then((w) => {
        if (cancelled) return;
        setPhase(w ? "locked" : "setup");
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setPhase("setup");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Idle auto-lock.
  useEffect(() => {
    if (phase !== "unlocked") return;
    const bump = () => {
      lastActivity.current = Date.now();
    };
    const check = () => {
      if (Date.now() - lastActivity.current > IDLE_LOCK_MS) {
        setDek(null);
        setPhase("locked");
      }
    };
    const events = ["click", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = window.setInterval(check, 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [phase]);

  const unlock = useCallback(async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      const w = await readWrapped();
      if (!w) throw new Error("No PIN set yet");
      const key = await unwrapDek(pin, w);
      setDek(key);
      setPhase("unlocked");
      lastActivity.current = Date.now();
    } catch {
      setError("Wrong PIN");
    } finally {
      setBusy(false);
    }
  }, []);

  const setInitialPin = useCallback(async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      const wrapped = await createWrappedDek(pin);
      await writeWrapped(wrapped);
      const key = await unwrapDek(pin, wrapped);
      setDek(key);
      setPhase("unlocked");
      lastActivity.current = Date.now();
    } catch (e) {
      console.error(e);
      setError("Could not set PIN");
    } finally {
      setBusy(false);
    }
  }, []);

  const lock = useCallback(() => {
    setDek(null);
    setPhase("locked");
  }, []);

  const changePin = useCallback(
    async (oldPin: string, newPin: string) => {
      const w = await readWrapped();
      if (!w) throw new Error("No PIN set");
      const key = await unwrapDek(oldPin, w);
      const rewrapped = await rewrapDek(key, newPin);
      await writeWrapped(rewrapped);
      setDek(key);
    },
    [],
  );

  const session = useMemo<CryptoSession>(
    () => ({
      dek,
      hasPin: phase !== "setup",
      unlock,
      setInitialPin,
      lock,
      changePin,
    }),
    [dek, phase, unlock, setInitialPin, lock, changePin],
  );

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-dvh text-sm opacity-60">
        Loading…
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <PinPad
        title="Create a PIN"
        subtitle="Protects your data on this device. If you forget it, your data cannot be recovered."
        confirm
        busy={busy}
        error={error}
        onSubmit={setInitialPin}
      />
    );
  }

  if (phase === "locked") {
    return (
      <PinPad
        title="Enter PIN"
        subtitle="Unlock Fitness 90"
        busy={busy}
        error={error}
        onSubmit={unlock}
      />
    );
  }

  return <CryptoCtx.Provider value={session}>{children}</CryptoCtx.Provider>;
}
