import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Geist, Geist_Mono } from "next/font/google";
import AppNavigation from "@/components/navigation/AppNavigation";
import { getUserRole } from "@/app/lib/user-roles";
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
  title: "Nightly | Find Your Vibe.",
  description: "A premium mobile-first nightlife discovery experience for Atlanta evenings.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  const role = userId ? await getUserRole(userId) : null;

  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <AppNavigation role={role}>{children}</AppNavigation>
        </body>
      </html>
    </ClerkProvider>
  );
}
