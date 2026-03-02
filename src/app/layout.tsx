import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Intelligence Engine - AI-Powered Profile Discovery",
  description: "Comprehensive AI-powered social intelligence platform for finding social media profiles and online presence. Multi-modal search with name, face recognition, email, phone, and username lookup.",
  keywords: ["Social Intelligence", "OSINT", "Profile Search", "Face Recognition", "AI", "Social Media", "Investigation", "Next.js"],
  authors: [{ name: "Social Intelligence Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Social Intelligence Engine",
    description: "AI-powered social media profile discovery and analysis",
    url: "https://chat.z.ai",
    siteName: "Social Intelligence Engine",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Intelligence Engine",
    description: "AI-powered social media profile discovery and analysis",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}

