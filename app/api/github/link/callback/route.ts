import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { upsertGithubLinkByUserId } from "@/lib/storage";
import { isoNow } from "@/lib/utils";

const LINK_STATE_COOKIE = "github_link_state";

type GithubLinkStatePayload = {
  state: string;
  userId: string;
  expiresAt: number;
};

type GithubTokenResponse = {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GithubUserResponse = {
  id?: number;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
};

type GithubEmailResponse = {
  email: string;
  primary: boolean;
  verified: boolean;
};

function isGithubLinkStatePayload(value: unknown): value is GithubLinkStatePayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.state === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt)
  );
}

function parseStateCookie(rawValue: string): GithubLinkStatePayload | null {
  // Primary format: base64url-encoded JSON.
  try {
    const decoded = Buffer.from(rawValue, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (isGithubLinkStatePayload(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to legacy parsing.
  }

  // Backward-compatible fallback for previously URL-encoded JSON cookies.
  const candidates: string[] = [rawValue];
  try {
    candidates.push(decodeURIComponent(rawValue));
  } catch {
    // Ignore decode errors; raw value attempt already included.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isGithubLinkStatePayload(parsed)) {
        return parsed;
      }
    } catch {
      // Try next format candidate.
    }
  }

  return null;
}

function redirectToSettings(request: Request, status: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("github_link", status);

  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: LINK_STATE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return redirectToSettings(request, "oauth_denied");
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  if (!code || !returnedState) {
    return redirectToSettings(request, "invalid_callback");
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return redirectToSettings(request, "unauthorized");
  }

  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!githubClientId || !githubClientSecret) {
    return redirectToSettings(request, "missing_config");
  }

  const stateCookieValue = request.cookies.get(LINK_STATE_COOKIE)?.value;
  if (!stateCookieValue) {
    return redirectToSettings(request, "state_missing");
  }

  const parsedState = parseStateCookie(stateCookieValue);
  if (!parsedState) {
    return redirectToSettings(request, "state_invalid");
  }

  if (Date.now() > parsedState.expiresAt) {
    return redirectToSettings(request, "state_expired");
  }

  if (parsedState.userId !== session.user.email) {
    return redirectToSettings(request, "state_user_mismatch");
  }

  if (parsedState.state !== returnedState) {
    return redirectToSettings(request, "state_mismatch");
  }

  try {
    const callbackUrl = new URL("/api/github/link/callback", request.url);

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: githubClientId,
        client_secret: githubClientSecret,
        code,
        state: returnedState,
        redirect_uri: callbackUrl.toString(),
      }),
    });

    const tokenBody = (await tokenResponse.json().catch(() => ({}))) as GithubTokenResponse;
    if (!tokenResponse.ok || !tokenBody.access_token) {
      return redirectToSettings(request, "token_error");
    }

    const githubHeaders = {
      Authorization: `Bearer ${tokenBody.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "versor-ai",
    };

    const userResponse = await fetch("https://api.github.com/user", {
      headers: githubHeaders,
    });

    const userBody = (await userResponse.json().catch(() => ({}))) as GithubUserResponse;
    if (!userResponse.ok || typeof userBody.id !== "number" || typeof userBody.login !== "string") {
      return redirectToSettings(request, "user_fetch_error");
    }

    let githubEmail = typeof userBody.email === "string" && userBody.email ? userBody.email : null;

    if (!githubEmail) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: githubHeaders,
      });

      if (emailResponse.ok) {
        const emailBody = (await emailResponse.json().catch(() => [])) as GithubEmailResponse[];
        const preferredEmail =
          emailBody.find((email) => email.primary && email.verified) ||
          emailBody.find((email) => email.verified) ||
          emailBody.find((email) => typeof email.email === "string");

        githubEmail = preferredEmail?.email || null;
      }
    }

    await upsertGithubLinkByUserId({
      userId: session.user.email,
      githubUserId: userBody.id,
      githubLogin: userBody.login,
      githubName: typeof userBody.name === "string" ? userBody.name : null,
      githubAvatarUrl: typeof userBody.avatar_url === "string" ? userBody.avatar_url : null,
      githubEmail,
      accessToken: tokenBody.access_token,
      scope: tokenBody.scope || null,
      timestamp: isoNow(),
    });

    return redirectToSettings(request, "success");
  } catch {
    return redirectToSettings(request, "error");
  }
}
