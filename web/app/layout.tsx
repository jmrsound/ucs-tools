import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UCS Tagger — describe a sound, find its UCS home",
  description:
    "Describe a sound in plain language and find its UCS v8.2.1 category. Runs entirely in your browser.",
  metadataBase: new URL("https://murphyryan.com/ucs-tagger/"),
  openGraph: {
    title: "UCS Tagger",
    description: "Describe a sound. Find its UCS home.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1734,
        height: 907,
        alt: "UCS Tagger — Describe a sound. Find its UCS home.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UCS Tagger",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
