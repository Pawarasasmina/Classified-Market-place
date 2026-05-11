import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classified Marketplace",
  description:
    "A trust-first classified marketplace for property, motors, jobs, electronics, and everyday local discovery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
