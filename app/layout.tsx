import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edyx — Social content, on your terms",
  description: "Turn a brief into platform-ready social media content with Edyx.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
