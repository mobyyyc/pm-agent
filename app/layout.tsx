import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import ClientLayout from "@/components/ClientLayout";
import { GuestProvider } from "@/components/GuestContext";
import ThemeProvider from "@/components/ThemeProvider";

const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
});

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${nunito.variable} antialiased`}>
        <ThemeProvider>
          <SessionProvider>
            <GuestProvider>
              <ClientLayout>{children}</ClientLayout>
            </GuestProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
