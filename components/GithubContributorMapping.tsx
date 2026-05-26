"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { contributorIdentityKey } from "@/lib/github-identities";
import type {
  GithubContributorIdentity,
  ProjectActivityEvent,
  ProjectMember,
  ProjectMemberGithubIdentity,
} from "@/types/models";

type ActivityResponse = {
  events?: ProjectActivityEvent[];
};

type MappingsResponse = {
  mappings?: ProjectMemberGithubIdentity[];
};

type ApiErrorBody = {
  error?: string;
  detail?: string | null;
  issues?: string[];
};

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  const details = [
    body?.error,
    body?.detail,
    Array.isArray(body?.issues) ? body.issues.join(" ") : null,
  ].filter(Boolean);

  return details.join(" ") || `Request failed with status ${response.status}.`;
}

function logMappingLoadError(details: {
  url: string;
  status?: number;
  body?: string;
  error?: unknown;
}) {
  if (process.env.NODE_ENV === "production") return;

  console.error("[GitHubContributorMapping] Failed to load contributor mapping.", details);
}

function normalizeValue(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function getContributorFromEvent(event: ProjectActivityEvent): GithubContributorIdentity | null {
  if (event.entityType !== "github_commit") return null;

  const githubLogin = typeof event.metadata.authorLogin === "string" ? event.metadata.authorLogin : null;
  const githubName = typeof event.metadata.authorName === "string" ? event.metadata.authorName : null;
  const githubEmail = typeof event.metadata.authorEmail === "string" ? event.metadata.authorEmail : null;

  if (!githubLogin && !githubName && !githubEmail) return null;

  return { githubLogin, githubName, githubEmail };
}

function findMappingForContributor(
  mappings: ProjectMemberGithubIdentity[],
  contributor: GithubContributorIdentity,
): ProjectMemberGithubIdentity | null {
  const login = normalizeValue(contributor.githubLogin);
  const email = normalizeValue(contributor.githubEmail);
  const name = normalizeValue(contributor.githubName);

  return (
    mappings.find((mapping) => normalizeValue(mapping.githubLogin) === login && login) ||
    mappings.find((mapping) => normalizeValue(mapping.githubEmail) === email && email) ||
    mappings.find((mapping) => normalizeValue(mapping.githubName) === name && name) ||
    null
  );
}

function getMemberLabel(member: ProjectMember | null | undefined): string {
  if (!member) return "Unmapped";
  return member.displayName?.trim() || member.userId;
}

function getContributorLabel(contributor: GithubContributorIdentity): string {
  return contributor.githubLogin
    ? `@${contributor.githubLogin}`
    : contributor.githubName || contributor.githubEmail || "Unknown contributor";
}

export default function GithubContributorMapping({
  projectId,
  members,
}: {
  projectId: string;
  members: ProjectMember[];
}) {
  const [events, setEvents] = useState<ProjectActivityEvent[]>([]);
  const [mappings, setMappings] = useState<ProjectMemberGithubIdentity[]>([]);
  const [draftMembers, setDraftMembers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadMappingData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const activityUrl = `/api/projects/${projectId}/activity?limit=100`;
      const mappingsUrl = `/api/projects/${projectId}/github-identities`;
      const [activityResponse, mappingsResponse] = await Promise.all([
        fetch(activityUrl, { cache: "no-store" }),
        fetch(mappingsUrl, { cache: "no-store" }),
      ]);

      if (!activityResponse.ok) {
        const body = await readApiError(activityResponse);
        logMappingLoadError({ url: activityUrl, status: activityResponse.status, body });
        throw new Error(body);
      }

      if (!mappingsResponse.ok) {
        const body = await readApiError(mappingsResponse);
        logMappingLoadError({ url: mappingsUrl, status: mappingsResponse.status, body });
        throw new Error(body);
      }

      const activityBody = (await activityResponse.json().catch(() => null)) as ActivityResponse | null;
      const mappingsBody = (await mappingsResponse.json().catch(() => null)) as MappingsResponse | null;

      setEvents(Array.isArray(activityBody?.events) ? activityBody.events : []);
      setMappings(Array.isArray(mappingsBody?.mappings) ? mappingsBody.mappings : []);
    } catch (loadError) {
      logMappingLoadError({
        url: `/api/projects/${projectId}/github-identities`,
        error: loadError,
      });
      setError("Failed to load GitHub contributor mapping.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMappingData();
  }, [loadMappingData]);

  const contributors = useMemo(() => {
    const byKey = new Map<string, GithubContributorIdentity>();
    const nextContributors: GithubContributorIdentity[] = [];

    for (const event of events) {
      const contributor = getContributorFromEvent(event);
      if (!contributor) continue;

      const key = contributorIdentityKey(contributor);
      const existing = byKey.get(key);

      if (existing) {
        existing.githubLogin ||= contributor.githubLogin;
        existing.githubEmail ||= contributor.githubEmail;
        existing.githubName ||= contributor.githubName;
        continue;
      }

      byKey.set(key, { ...contributor });
      nextContributors.push(byKey.get(key) as GithubContributorIdentity);
    }

    return nextContributors;
  }, [events]);

  const handleSave = async (contributor: GithubContributorIdentity) => {
    const key = contributorIdentityKey(contributor);
    const existingMapping = findMappingForContributor(mappings, contributor);
    const memberId = draftMembers[key] ?? existingMapping?.memberId ?? "";

    if (!memberId) {
      setError("Choose a project member before saving.");
      return;
    }

    setPendingKey(key);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/github-identities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: existingMapping?.id,
          memberId,
          githubLogin: contributor.githubLogin,
          githubName: contributor.githubName,
          githubEmail: contributor.githubEmail,
        }),
      });

      const body = (await response.json().catch(() => null)) as { mapping?: ProjectMemberGithubIdentity; error?: string } | null;
      if (!response.ok || !body?.mapping) {
        throw new Error(body?.error || "Failed to save mapping.");
      }

      setMappings((currentMappings) => [
        body.mapping as ProjectMemberGithubIdentity,
        ...currentMappings.filter((mapping) => mapping.id !== body.mapping?.id),
      ]);
      setSuccess("GitHub contributor mapping saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save mapping.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleRemove = async (contributor: GithubContributorIdentity) => {
    const key = contributorIdentityKey(contributor);
    const existingMapping = findMappingForContributor(mappings, contributor);
    if (!existingMapping) return;

    setPendingKey(key);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/github-identities/${existingMapping.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove mapping.");
      }

      setMappings((currentMappings) => currentMappings.filter((mapping) => mapping.id !== existingMapping.id));
      setDraftMembers((currentDrafts) => ({ ...currentDrafts, [key]: "" }));
      setSuccess("GitHub contributor mapping removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove mapping.");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <section className="app-frame app-frame-hover rounded-2xl p-6 transition-colors">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-white">GitHub Contributor Mapping</h2>
        <button
          type="button"
          onClick={() => void loadMappingData()}
          disabled={loading}
          className="app-button app-button-ghost min-h-8 self-start px-3 py-1 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <div className="error-msg mb-3 px-3 py-2 text-sm font-semibold">{error}</div> : null}
      {success ? <p className="app-notice app-notice-success mb-3 px-3 py-2 text-sm font-semibold">{success}</p> : null}

      {contributors.length === 0 ? (
        <p className="app-empty-state">Sync commits to detect GitHub contributors.</p>
      ) : (
        <div className="space-y-3">
          {contributors.map((contributor) => {
            const key = contributorIdentityKey(contributor);
            const mapping = findMappingForContributor(mappings, contributor);
            const mappedMember = members.find((member) => member.userId === mapping?.memberId) || null;
            const selectedMemberId = draftMembers[key] ?? mapping?.memberId ?? "";
            const isPending = pendingKey === key;

            return (
              <div key={key} className="surface-card rounded-xl p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{getContributorLabel(contributor)}</p>
                    <p className="mt-1 break-words text-xs text-neutral-400">
                      {[contributor.githubName, contributor.githubEmail].filter(Boolean).join(" · ") || "No name/email in commit metadata"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">Mapped to: {getMemberLabel(mappedMember)}</p>
                  </div>

                  <select
                    value={selectedMemberId}
                    onChange={(event) => setDraftMembers((currentDrafts) => ({ ...currentDrafts, [key]: event.target.value }))}
                    className="app-field"
                  >
                    <option value="">Choose member</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {getMemberLabel(member)}
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSave(contributor)}
                      disabled={isPending || !selectedMemberId}
                      className="app-button app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Saving..." : "Save"}
                    </button>
                    {mapping ? (
                      <button
                        type="button"
                        onClick={() => void handleRemove(contributor)}
                        disabled={isPending}
                        className="app-button app-destructive-button disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
