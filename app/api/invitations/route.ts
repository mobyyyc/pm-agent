import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

type InvitationItem = {
  id: string;
  projectName: string;
  invitedBy: string;
  role: string | null;
  invitedAt: string | null;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Placeholder for future project-member invitation persistence.
    const invitations: InvitationItem[] = [];

    return NextResponse.json({ invitations });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch invitations.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
