import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoomly | Video Conferencing",
  description: "A high-performance, modern video conferencing platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


