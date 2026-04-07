import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verseline",
  description: "Timed-text video editor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
