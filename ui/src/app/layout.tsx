import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KORA Child Safety Evals",
  description: "UI for KORA benchmark evaluation methods",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
