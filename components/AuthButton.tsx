
'use client';

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-600">Signed in as {session.user?.email}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="app-destructive-button cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("google")}
      className="key-button cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      Sign in with Google
    </button>
  );
}
