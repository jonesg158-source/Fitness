"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useCryptoSession } from "@/lib/crypto/session";

export default function SettingsPage() {
  const { lock, changePin } = useCryptoSession();
  const profile = useLiveQuery(() => db.profile.get("me"), []);
  const [changing, setChanging] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="px-5 py-6 space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="text-xs uppercase tracking-wider opacity-60">
          Account
        </div>
        {profile ? (
          <div className="text-sm mt-1 space-y-0.5">
            <div>Sex: <span className="capitalize">{profile.sex}</span></div>
            <div>Age: {profile.age}</div>
            <div>Height: {profile.heightCm} cm</div>
            <div>Goal: <span className="capitalize">{profile.goal}</span></div>
            <div>
              Target: {profile.targetWeightKg} kg by {profile.targetDate}
            </div>
          </div>
        ) : (
          <div className="text-sm opacity-60 mt-1">No profile yet.</div>
        )}
      </section>

      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="text-xs uppercase tracking-wider opacity-60">
          Security
        </div>
        <button
          className="mt-2 h-11 w-full rounded-xl bg-slate-200 dark:bg-slate-800 font-medium"
          onClick={lock}
        >
          Lock now
        </button>
        {!changing ? (
          <button
            className="mt-2 h-11 w-full rounded-xl bg-slate-200 dark:bg-slate-800 font-medium"
            onClick={() => setChanging(true)}
          >
            Change PIN
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <input
              type="password"
              placeholder="Current PIN"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value)}
              className="h-11 w-full rounded-xl px-3 bg-slate-100 dark:bg-slate-800"
            />
            <input
              type="password"
              placeholder="New PIN (4–6 digits)"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="h-11 w-full rounded-xl px-3 bg-slate-100 dark:bg-slate-800"
            />
            <div className="flex gap-2">
              <button
                className="flex-1 h-11 rounded-xl bg-slate-200 dark:bg-slate-800 font-medium"
                onClick={() => {
                  setChanging(false);
                  setOldPin("");
                  setNewPin("");
                  setMsg(null);
                }}
              >
                Cancel
              </button>
              <button
                className="flex-1 h-11 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
                disabled={oldPin.length < 4 || newPin.length < 4}
                onClick={async () => {
                  try {
                    await changePin(oldPin, newPin);
                    setMsg("PIN updated");
                    setChanging(false);
                    setOldPin("");
                    setNewPin("");
                  } catch {
                    setMsg("Wrong current PIN");
                  }
                }}
              >
                Update
              </button>
            </div>
            {msg ? <div className="text-xs opacity-70">{msg}</div> : null}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm text-sm opacity-70">
        Export/import, unit toggle, and program swap arrive in Phase 5.
      </section>
    </div>
  );
}
