import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ViewTransitions } from "next-view-transitions";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Skillify That — Expert Skill Atlas Generator",
  description:
    "Extract reusable skill packages from any expert's public content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <ClerkProvider>
        <html lang="en">
          <body className={`${inter.variable} antialiased`}>
            {children}
            <Toaster />
          </body>
        </html>
      </ClerkProvider>
    </ViewTransitions>
  );
}
