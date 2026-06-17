import type { Metadata } from "next";
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
      var profile = stored === "light" || stored === "dark" ? stored : "light";
      document.documentElement.dataset.colorProfile = profile;
      document.documentElement.style.colorScheme = profile;
    } catch (error) {
      document.documentElement.dataset.colorProfile = "light";
      document.documentElement.style.colorScheme = "light";
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
      data-color-profile="light"
      suppressHydrationWarning
    >
      <head>
        <script
          id="color-profile-script"
          dangerouslySetInnerHTML={{ __html: colorProfileScript }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
