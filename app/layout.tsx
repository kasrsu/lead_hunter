import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lead Hunter — Enterprise Lead Intelligence & Outreach OS",
  description:
    "Scan Google Maps for high-opportunity businesses, calculate 4-part metrics, run autonomous agent drafting & human approval.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-gradient-to-br from-amber-50/60 via-orange-50/30 to-slate-50 min-h-screen selection:bg-orange-500/20 selection:text-orange-950">
        {children}
      </body>
    </html>
  );
}
