import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLL Robotics Coach - Innovation Project",
  description: "AI-Powered Coaching for Your FIRST LEGO League Innovation Project",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
