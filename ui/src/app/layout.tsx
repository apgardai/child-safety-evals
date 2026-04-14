import type { Metadata } from "next";

import { TopNav } from "@/components/TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Child Safety AI Evaluations",
  description: "UI for child safety benchmark evaluation methods",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
