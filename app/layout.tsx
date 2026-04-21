import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LockGate } from "@/components/LockGate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "Fitness 90",
  description:
    "Personal 90-day transformation tracker: adaptive macros, hypertrophy programming, progress photos.",
  applicationName: "Fitness 90",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fitness 90",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <LockGate>
          <main className="mx-auto max-w-xl min-h-dvh pb-24 pt-safe">
            {children}
          </main>
          <TabBar />
        </LockGate>
      </body>
    </html>
  );
}
