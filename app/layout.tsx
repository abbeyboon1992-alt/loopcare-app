import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavWrapper from "@/components/navWrapper";
import OfflineBanner from "@/components/OfflineBanner";
import { AccessProvider } from "@/app/context/AccessContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LoopCare",
  description: "Care management app",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        
        <AccessProvider>
          <OfflineBanner />
          <NavWrapper />

          <main className="pt-20 px-3 sm:px-4 md:px-6 max-w-5xl mx-auto w-full">
            {children}
          </main>
        </AccessProvider>

      </body>
    </html>
  );
}