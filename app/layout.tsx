import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LockGate } from "@/components/LockGate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { TabBar } from "@/components/TabBar";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Fitness 90",
  description:
    "Personal 90-day transformation tracker: adaptive macros, hypertrophy programming, progress photos.",
  applicationName: "Fitness 90",
  manifest: `${BASE_PATH}/manifest.webmanifest`,
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
