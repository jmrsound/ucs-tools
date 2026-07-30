import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UCS Category Finder",
  description:
    "Describe a sound in plain language and find likely Universal Category System categories.",
  metadataBase: new URL("https://ucs-category-finder.openai.site"),
  openGraph: {
    title: "UCS Category Finder",
    description: "Describe a sound. Find its UCS home.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1734,
        height: 907,
        alt: "UCS Category Finder — Describe a sound. Find its UCS home.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UCS Category Finder",
    description: "Describe a sound. Find its UCS home.",
    images: ["/og.png"],
  },
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
