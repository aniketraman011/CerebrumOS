import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CerebrumOS AI Operations",
  description: "High-Performance Next.js Dashboard for CerebrumOS Inference Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-900 text-white flex min-h-screen`}>
        <Sidebar />
        <div className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
