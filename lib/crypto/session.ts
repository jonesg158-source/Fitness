"use client";

import { createContext, useContext } from "react";

/**
 * Holds the unwrapped DEK in memory only while the app is unlocked.
 * Cleared on lock, on page hide > 10 min, and on tab close.
 */
export type CryptoSession = {
  dek: CryptoKey | null;
  hasPin: boolean;
  unlock: (pin: string) => Promise<void>;
  setInitialPin: (pin: string) => Promise<void>;
  lock: () => void;
  changePin: (oldPin: string, newPin: string) => Promise<void>;
};

export const CryptoCtx = createContext<CryptoSession | null>(null);

export function useCryptoSession(): CryptoSession {
  const v = useContext(CryptoCtx);
  if (!v) throw new Error("useCryptoSession must be used inside <LockGate>");
  return v;
}
