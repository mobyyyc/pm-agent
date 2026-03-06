import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import ClientLayout from "@/components/ClientLayout";
import { GuestProvider } from "@/components/GuestContext";

export const metadata: Metadata = {
  title: "VERSOR",
  description: "Prototype AI-powered project management app with Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider>
          <GuestProvider>
            <ClientLayout>{children}</ClientLayout>
          </GuestProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
