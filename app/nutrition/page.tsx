"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayIso } from "@/lib/util/date";

export default function NutritionIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/nutrition/log?date=${todayIso()}`);
  }, [router]);
  return null;
}
