"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Today", icon: "☀️" },
  { href: "/nutrition", label: "Nutrition", icon: "🥗" },
  { href: "/training", label: "Training", icon: "💪" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function TabBar() {
  const pathname = usePathname();
  // Hide the tab bar on onboarding and lock screens.
  if (pathname?.startsWith("/onboarding") || pathname?.startsWith("/lock")) {
    return null;
  }
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 pb-safe"
      aria-label="Primary"
    >
      <ul className="mx-auto max-w-xl grid grid-cols-5">
        {tabs.map((t) => {
          const active =
            pathname === t.href ||
            (t.href !== "/today" && pathname?.startsWith(t.href));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={[
                  "flex flex-col items-center justify-center py-2 text-xs",
                  active
                    ? "text-brand-600 font-semibold"
                    : "text-slate-600 dark:text-slate-300",
                ].join(" ")}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {t.icon}
                </span>
                <span className="mt-0.5">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
