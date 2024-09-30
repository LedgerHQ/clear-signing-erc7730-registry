import "~/styles/globals.css";

import { Inter, Roboto } from "next/font/google";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Clear Signing Preview",
};

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

const roboto = Roboto({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-roboto",
  weight: ["400", "500"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${roboto.className} ${roboto.variable} ${inter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
