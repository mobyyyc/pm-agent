import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { deleteGithubLinkByUserId, getGithubLinkByUserId } from "@/lib/storage";

type RevokeResult = {
  revoked: boolean;
  warning?: string;
};

async function revokeGithubAuthorization(accessToken: string): Promise<RevokeResult> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      revoked: false,
      warning: "GitHub OAuth credentials are missing, so remote authorization could not be revoked.",
    };
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await fetch(`https://api.github.com/applications/${clientId}/grant`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "versor-ai",
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (response.ok || response.status === 404 || response.status === 422) {
      // 404/422 can happen when token or grant was already revoked.
      return { revoked: true };
    }

    const details = await response.text().catch(() => "");
    return {
      revoked: false,
      warning: details
        ? `GitHub authorization revoke failed (${response.status}): ${details}`
        : `GitHub authorization revoke failed with status ${response.status}.`,
    };
  } catch {
    return {
      revoked: false,
      warning: "GitHub authorization revoke request failed.",
    };
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const link = await getGithubLinkByUserId(session.user.email);

    if (!link) {
      return NextResponse.json({ linked: false, link: null });
    }

    return NextResponse.json({
      linked: true,
      link: {
        githubLogin: link.githubLogin,
        githubName: link.githubName,
        githubAvatarUrl: link.githubAvatarUrl,
        githubEmail: link.githubEmail,
        updatedAt: link.updatedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load linked Github account.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const link = await getGithubLinkByUserId(session.user.email);
    const revokeResult = link ? await revokeGithubAuthorization(link.accessToken) : { revoked: true };

    await deleteGithubLinkByUserId(session.user.email);

    return NextResponse.json({
      success: true,
      revoked: revokeResult.revoked,
      warning: revokeResult.warning || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to unlink Github account.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
