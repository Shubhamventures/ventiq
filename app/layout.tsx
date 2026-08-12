import Providers from "./providers";
import DebtLmsFloatingNav from "./components/DebtLmsFloatingNav";
import PrivateRouteGate from "./components/PrivateRouteGate";
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
    default: "VENTIQ | AI Stakeholder Dashboards for Private Capital",
    template: "%s | VENTIQ",
  },

  description:
    "VENTIQ gives private capital firms one connected fund data foundation powering role-specific dashboards, governed workflows, documents and investor access for Managing Partners, Finance, Investment, Compliance, Investor Relations and Investors.",

  keywords: [
    "VENTIQ",
    "useventiq",
    "use ventiq",
    "AI stakeholder dashboards",
    "private capital software",
    "AIF software",
    "Indian AIF software",
    "fund operations software",
    "fund management software",
    "capital call software",
    "distribution waterfall software",
    "investor reporting platform",
    "investor portal",
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


  openGraph: {
    title: "VENTIQ | AI Stakeholder Dashboards for Private Capital",
    description:
      "One fund. Six stakeholders. One source of truth. VENTIQ connects fund data, documents, workflows and controlled stakeholder access in one private-capital platform.",
    url: "https://useventiq.com",
    siteName: "VENTIQ",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "VENTIQ — AI Stakeholder Dashboards for Private Capital",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "VENTIQ | AI Stakeholder Dashboards for Private Capital",
    description:
      "One fund. Six stakeholders. One source of truth. Role-specific intelligence and workflows powered by connected private-capital data.",
    images: ["/opengraph-image"],
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
      <body className="min-h-full flex flex-col">
        <Providers>
          <PrivateRouteGate>
            {children}
            <DebtLmsFloatingNav />
          </PrivateRouteGate>
        </Providers>
      </body>
    </html>
  );
}
