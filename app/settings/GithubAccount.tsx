"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type GithubLinkResponse = {
  linked: boolean;
  link: {
    githubLogin: string;
    githubName: string | null;
    githubAvatarUrl: string | null;
    githubEmail: string | null;
    updatedAt: string | null;
  } | null;
};

const statusMessages: Record<string, string> = {
  success: "Github account linked successfully.",
  oauth_denied: "Github authorization was canceled.",
  token_error: "Failed to complete Github authorization. Please try again.",
  user_fetch_error: "Linked account was authorized but profile details could not be read.",
  state_missing: "Linking session expired. Please click the button again.",
  state_invalid: "Linking session is invalid. Please click the button again.",
  state_expired: "Linking session expired. Please click the button again.",
  state_user_mismatch: "Current signed-in user does not match the linking session.",
  state_mismatch: "Security validation failed. Please restart linking.",
  invalid_callback: "Invalid Github callback response.",
  unauthorized: "You must be signed in before linking Github.",
  missing_config: "Github OAuth is not configured yet.",
  error: "Failed to link Github account.",
};

export default function GithubAccountSettings() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [linkedAccount, setLinkedAccount] = useState<GithubLinkResponse["link"]>(null);

  const linkStatus = searchParams.get("github_link");
  const linkStatusMessage = useMemo(() => {
    if (!linkStatus || linkStatus === "success") return null;
    return statusMessages[linkStatus] || "Github linking status updated.";
  }, [linkStatus]);

  useEffect(() => {
    let active = true;

    const loadLinkStatus = async () => {
      try {
        setLoadError(null);
        const response = await fetch("/api/github/link", { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as Partial<GithubLinkResponse> & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error || "Failed to load Github link status.");
        }

        if (!active) return;
        setLinkedAccount(body.linked ? body.link || null : null);
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load Github link status.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadLinkStatus();

    return () => {
      active = false;
    };
  }, []);

  const handleUnlinkGithub = async () => {
    setActionError(null);
    setActionSuccess(null);
    setUnlinking(true);

    try {
      const response = await fetch("/api/github/link", { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        revoked?: boolean;
        warning?: string | null;
      };

      if (!response.ok) {
        throw new Error(body.error || "Failed to unlink Github account.");
      }

      setLinkedAccount(null);
      if (body.revoked === false) {
        setActionSuccess("Github account unlinked locally. GitHub authorization could not be fully revoked.");
      } else {
        setActionSuccess("Github account unlinked and authorization revoked.");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to unlink Github account.");
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Github Account</h2>

      <div className="app-frame-item rounded-xl p-5">
        <p className="text-sm leading-relaxed text-neutral-300">
          Link your Versor account to your Github account to manage repositories for group projects.
        </p>

        {linkStatusMessage ? <p className="mt-3 text-sm text-red-400">{linkStatusMessage}</p> : null}
        {loadError ? <p className="mt-3 text-sm text-red-400">{loadError}</p> : null}
        {actionError ? <p className="mt-3 text-sm text-red-400">{actionError}</p> : null}
        {actionSuccess ? <p className="mt-3 text-sm text-green-400">{actionSuccess}</p> : null}

        {linkedAccount ? (
          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-neutral-300">
            <div className="flex items-center gap-3">
              {linkedAccount.githubAvatarUrl ? (
                <img
                  src={linkedAccount.githubAvatarUrl}
                  alt={`${linkedAccount.githubLogin} Github avatar`}
                  className="h-12 w-12 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-base font-semibold text-white">
                  {linkedAccount.githubLogin.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div>
                <p>
                  Connected as{" "}
                  <span className="font-semibold text-white">{linkedAccount.githubName || linkedAccount.githubLogin}</span>
                </p>
                <p className="mt-1 text-neutral-400">@{linkedAccount.githubLogin}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {linkedAccount ? (
        <button
          type="button"
          onClick={() => void handleUnlinkGithub()}
          disabled={loading || unlinking}
          className="app-danger-button rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {unlinking ? "Unlinking..." : "Unlink Github Account"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setActionError(null);
            setActionSuccess(null);
            window.location.assign("/api/github/link/start");
          }}
          disabled={loading || unlinking}
          className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {loading ? "Checking..." : "Link Github Account"}
        </button>
      )}
    </div>
  );
}
