import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Geist, Geist_Mono } from "next/font/google";
import AppNavigation from "@/components/navigation/AppNavigation";
import { getUserRole } from "@/app/lib/user-roles";
import { getCurrentVenueDeviceActor } from "@/lib/nightly-device/auth";
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
  const [role, deviceActor] = await Promise.all([
    userId ? getUserRole(userId) : null,
    userId ? getCurrentVenueDeviceActor() : null,
  ]);

  return (
    <ClerkProvider>
      <html
        lang="en"
        data-scroll-behavior="smooth"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <AppNavigation role={role} hasDeviceAccess={Boolean(deviceActor)}>{children}</AppNavigation>
        </body>
      </html>
    </ClerkProvider>
  );
}
