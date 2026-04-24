
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { normalizeUserId, upsertAppUser } from "@/lib/storage";
import { isoNow } from "@/lib/utils";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user?.email) {
        return false;
      }

      try {
        await upsertAppUser({
          userId: normalizeUserId(user.email),
          displayName: user.name || null,
          imageUrl: user.image || null,
          timestamp: isoNow(),
        });
      } catch (error) {
        console.error("Failed to sync signed-in user:", error);
      }

      return true;
    },
    async session({ session }) {
      if (session?.user) {
        // Add additional user info to session if needed
      }
      return session;
    },
  },
};
