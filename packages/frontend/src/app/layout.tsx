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
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
