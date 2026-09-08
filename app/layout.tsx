import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
