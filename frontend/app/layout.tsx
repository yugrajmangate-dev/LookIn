import type { Metadata } from "next";
import React from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ChunkErrorRecovery from "@/components/ChunkErrorRecovery";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LookIn — Student Attendance System",
  description:
    "Computer-vision-powered student attendance management dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ChunkErrorRecovery />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
