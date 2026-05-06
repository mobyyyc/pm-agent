import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

const LINK_STATE_COOKIE = "github_link_state";
const LINK_STATE_TTL_SECONDS = 60 * 10;

type GithubLinkStatePayload = {
  state: string;
  userId: string;
  expiresAt: number;
  returnTo?: string;
};

function encodeStatePayload(payload: GithubLinkStatePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return redirectToSettings(request, "unauthorized");
  }

  const githubClientId = process.env.GITHUB_CLIENT_ID;
  if (!githubClientId) {
    return redirectToSettings(request, "missing_config");
  }

  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope");
  const returnToParam = url.searchParams.get("return_to");
  const returnTo =
    returnToParam && returnToParam.startsWith("/") && !returnToParam.startsWith("//") ? returnToParam : undefined;
  const scope = requestedScope === "delete_repo" ? "read:user user:email repo delete_repo" : "read:user user:email repo";
  const state = crypto.randomUUID();
  const payload: GithubLinkStatePayload = {
    state,
    userId: session.user.email,
    expiresAt: Date.now() + LINK_STATE_TTL_SECONDS * 1000,
    returnTo,
  };

  const callbackUrl = new URL("/api/github/link/callback", request.url);
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", githubClientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set({
    name: LINK_STATE_COOKIE,
    value: encodeStatePayload(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LINK_STATE_TTL_SECONDS,
  });

  return response;
}
