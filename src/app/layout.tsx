import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is highly legible for data-dense ERPs
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "School ERP System",
  description: "Enterprise Resource Planning for Schools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-gray-50 text-slate-900`}>
        {children}
      </body>
    </html>
  );
}