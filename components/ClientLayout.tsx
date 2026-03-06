
"use client";

import { useSession, signIn } from "next-auth/react";
import AppShell from "@/components/AppShell";
import { useEffect } from "react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
        // Automatically redirect to sign in if not authenticated
        // signIn("google"); // Using this might cause a loop if the signin page is this page.
        // Instead, just show the login button in the shell logic.
    }
  }, [status]);

  if (status === "loading") {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-black text-white">
            <p>Loading...</p>
        </div>
    );
  }

  if (!session) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-6 bg-black p-4 text-white">
            <h1 className="text-4xl font-semibold tracking-tight">
              <span className="text-white/95">VERSOR</span>
              <span className="ml-0.5 text-neutral-400">.AI</span>
            </h1>
            <p className="text-white/60">Please sign in to access your projects.</p>
            <button
                onClick={() => signIn("google", { callbackUrl: "/" })}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-sm hover:bg-neutral-200 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white"
            >
                Sign in with Google
            </button>
        </div>
      );
  }

  return <AppShell>{children}</AppShell>;
}
