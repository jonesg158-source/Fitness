"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";

export default function RootRedirect() {
  const router = useRouter();
  const profile = useLiveQuery(() => db.profile.get("me"), []);

  useEffect(() => {
    if (profile === undefined) return; // still loading
    if (!profile) router.replace("/onboarding");
    else router.replace("/today");
  }, [profile, router]);

  return (
    <div className="flex items-center justify-center min-h-dvh text-sm opacity-60">
      Loading…
    </div>
  );
}
