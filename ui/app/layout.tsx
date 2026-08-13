import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { TopNav } from "components/TopNav";
import { Footer } from "components/Footer";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "apgard — Youth AI Safety Benchmark",
  description:
    "See how frontier models perform on youth mental wellbeing and youth sexual safety risks",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} scroll-smooth`}>
      <body className="min-h-screen bg-[var(--bg)] font-poppins text-[var(--text)] antialiased">
        <TopNav />
        <main>{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
