import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  metadataBase: new URL("https://useventiq.com"),

  title: {
    default: "VENTIQ | AI Operating System for Private Capital",
    template: "%s | VENTIQ",
  },

  description:
    "VENTIQ is a real-time operating system for private capital firms, connecting fund operations, compliance, portfolio intelligence, investor reporting and stakeholder dashboards into one secure fund data core.",

  keywords: [
    "VENTIQ",
    "useventiq",
    "use ventiq",
    "private capital operating system",
    "AI operating system for private capital",
    "AIF software",
    "Indian AIF software",
    "fund operations software",
    "fund management software",
    "capital call software",
    "distribution waterfall software",
    "repayment notice software",
    "investor reporting platform",
    "portfolio intelligence software",
    "GIFT City fund operations",
    "private credit fund software",
    "venture capital fund operations",
    "private equity fund operations",
  ],

  authors: [{ name: "VENTIQ" }],
  creator: "VENTIQ",
  publisher: "VENTIQ",
  applicationName: "VENTIQ",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "VENTIQ | AI Operating System for Private Capital",
    description:
      "One secure fund data core powering role-based workspaces for Managing Partners, Finance Heads, Compliance Officers, Investment Teams, Investor Relations teams and Investors.",
    url: "https://useventiq.com",
    siteName: "VENTIQ",
    type: "website",
    locale: "en_IN",
  },

  twitter: {
    card: "summary_large_image",
    title: "VENTIQ | AI Operating System for Private Capital",
    description:
      "VENTIQ connects fund operations, compliance, portfolio intelligence, investor reporting and stakeholder dashboards into one secure fund data core.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
