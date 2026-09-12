import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "THIRDMAN — AI football tactics sandbox",
  description:
    "See the game differently. Move players, change the shape, and ask AI how the game changes. An interactive football tactics sandbox.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
