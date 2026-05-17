
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { sendLoginInfoEmail } from "@/lib/notifications";
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

      const timestamp = isoNow();
      const userId = normalizeUserId(user.email);

      try {
        await upsertAppUser({
          userId,
          displayName: user.name || null,
          imageUrl: user.image || null,
          timestamp,
        });
      } catch (error) {
        console.error("Failed to sync signed-in user:", error);
      }

      try {
        await sendLoginInfoEmail({
          email: userId,
          displayName: user.name || null,
          loggedInAt: timestamp,
        });
      } catch (error) {
        console.error("Failed to send login notification:", error);
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
