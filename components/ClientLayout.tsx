
"use client";

import { useSession, signIn } from "next-auth/react";
import AppShell from "@/components/AppShell";
import { useGuest } from "@/components/GuestContext";
import { useEffect } from "react";
import ThemeToggleButton from "@/components/ThemeToggleButton";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { isGuest, enterGuestMode } = useGuest();

  useEffect(() => {
    if (status === "unauthenticated") {
        // Automatically redirect to sign in if not authenticated
        // signIn("google"); // Using this might cause a loop if the signin page is this page.
        // Instead, just show the login button in the shell logic.
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div className="relative flex h-screen w-full items-center justify-center bg-black text-white">
        <ThemeToggleButton className="absolute right-4 top-4" />
            <p>Loading...</p>
        </div>
    );
  }

  // Allow through if authenticated OR in guest mode
  if (session || isGuest) {
    return <AppShell>{children}</AppShell>;
  }

  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-6 bg-black p-4 text-white">
        <ThemeToggleButton className="absolute right-4 top-4" />
        <h1 className="text-4xl font-semibold tracking-tight">
          <span className="text-white/95">VERSOR</span>
          <span className="ml-0.5 text-neutral-400">.AI</span>
        </h1>
        <p className="text-white/60">Please sign in to access your projects.</p>
        <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
          className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-sm hover:bg-neutral-200 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
        >
            Sign in with Google
        </button>
        <button
            onClick={enterGuestMode}
          className="rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all cursor-pointer"
        >
            Continue without signing in
        </button>
        <p className="text-xs text-neutral-600 max-w-xs text-center">
            Guest projects are temporary and will be lost when you leave.
        </p>
    </div>
  );
}
