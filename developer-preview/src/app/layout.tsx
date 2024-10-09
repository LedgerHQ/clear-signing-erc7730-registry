import "~/styles/globals.css";

import { Inter } from "next/font/google";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Clear Signing Preview",
  description: "Preview your Clear Signing JSON files",
  icons: [
    {
      rel: "icon",
      url: "/assets/icon.svg",
    },
  ],
};

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} ${inter.variable}`}>
      <body className="bg-tool-background">{children}</body>
    </html>
  );
}
