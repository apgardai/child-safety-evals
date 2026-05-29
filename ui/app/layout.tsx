import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { TopNav } from "components/TopNav";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "apgard — Youth Mental Wellbeing Evaluations",
  description: "Benchmark tooling and scenario review for youth mental wellbeing evaluations",
  icons: {
    icon: "/favicon-32x32.png",
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
      </body>
    </html>
  );
}
