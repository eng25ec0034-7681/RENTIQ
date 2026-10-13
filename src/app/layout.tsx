import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "RENTIQ - Rent Smart. Spend Less.",
  description: "Student-only platform for rentals, printing/Xerox and delivery.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RENTIQ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#00E5B0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090D16] text-white min-h-[100dvh] flex flex-col antialiased selection:bg-brand-teal selection:text-slate-950">
        <TopNav />
        <main className="flex-1 w-full max-w-lg mx-auto min-h-[100dvh] flex flex-col pb-20">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
