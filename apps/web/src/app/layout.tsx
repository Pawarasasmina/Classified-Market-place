import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classified Marketplace",
  description:
    "A trust-first classified marketplace for property, motors, jobs, electronics, and everyday local discovery.",
};

const colorProfileScript = `
  (function () {
    try {
      var stored = window.localStorage.getItem("smartmarket-color-profile");
      var profile = stored === "light" ? "light" : "dark";
      document.documentElement.dataset.colorProfile = profile;
      document.documentElement.style.colorScheme = profile;
    } catch (error) {
      document.documentElement.dataset.colorProfile = "dark";
      document.documentElement.style.colorScheme = "dark";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-color-profile="dark"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script
          id="color-profile-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: colorProfileScript }}
        />
        {children}
      </body>
    </html>
  );
}
