"use client";

import { useEffect, useState } from "react";

type Commit = {
  sha: string;
  message: string;
  authorName: string | null;
  date: string | null;
  htmlUrl: string;
  verified: boolean;
};

export default function RepoCommits({ projectId, owner, repo }: { projectId: string; owner: string; repo: string }) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    // reset when repo changes
    setCommits([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setSyncMessage(null);
  }, [owner, repo]);

  useEffect(() => {
    let cancelled = false;
    async function fetchCommits() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/repository/commits?page=${page}&per_page=10`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body && (body.error || body.message)) || `Status ${res.status}`);
        }

        const body = await res.json();
        if (cancelled) return;
        const newCommits: Commit[] = Array.isArray(body.commits) ? body.commits : [];
        setCommits((prev) => (page === 1 ? newCommits : prev.concat(newCommits)));
        setHasMore(newCommits.length >= 10);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load commits.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCommits();
    return () => {
      cancelled = true;
    };
  }, [projectId, owner, repo, page]);

  if (!owner || !repo) return null;

  const handleSyncCommits = async () => {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/repository/commits/sync`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        syncedCount?: number;
        skippedCount?: number;
        error?: string;
        detail?: string;
      };

      if (!res.ok) {
        throw new Error(body.detail || body.error || `Status ${res.status}`);
      }

      const syncedCount = Number(body.syncedCount || 0);
      setSyncMessage(`Synced ${syncedCount} new commits`);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync commits.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-semibold tracking-tight text-white">Recent Commits</h3>
        <button
          type="button"
          onClick={() => void handleSyncCommits()}
          disabled={syncing}
          className="normal-button self-start rounded-full px-3 py-1 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          {syncing ? "Syncing..." : "Sync commits"}
        </button>
      </div>
      {error ? <div className="error-msg mb-3 px-3 py-2 text-sm font-semibold">{error}</div> : null}
      {syncMessage ? <p className="mb-3 text-sm font-semibold text-green-400">{syncMessage}</p> : null}

      <div className="relative">
        {/* Vertical line behind the commit items */}
        <div className="absolute left-4 top-0 bottom-0 w-px commit-card-line" />

        <ul className="space-y-6">
          {commits.map((c) => (
            <li key={c.sha} className="relative pl-12">
              {/* Commit symbol */}
              <span className="absolute left-0 top-3 flex h-8 w-8 items-center justify-center">
                <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full commit-node commit-card-border">
                  <span className="block h-2.5 w-2.5 rounded-full bg-white" />
                </span>
              </span>

              <div className="commit-card rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <a href={c.htmlUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-white hover:underline">
                    {c.message.split('\n')[0] || "(no message)"}
                  </a>
                  {c.verified ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold verified-commit-badge">
                      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 fill-current">
                        <path d="M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13Zm3.03 5.22-3.4 3.4a.75.75 0 0 1-1.06 0L4.97 8.48a.75.75 0 1 1 1.06-1.06l1.06 1.06 2.87-2.87a.75.75 0 1 1 1.06 1.06Z" />
                      </svg>
                      Verified
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-neutral-400">
                  {c.authorName ? `${c.authorName} • ` : ""}
                  {c.date ? new Date(c.date).toLocaleString() : ""}
                </div>
                <div className="mt-2 text-xs text-neutral-500">{c.sha.slice(0, 7)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={page === 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="sub-button rounded-full px-3 py-1 text-sm disabled:opacity-60"
        >
          Prev
        </button>

        <button
          type="button"
          disabled={!hasMore || loading}
          onClick={() => setPage((p) => p + 1)}
          className="key-button rounded-full px-3 py-1 text-sm disabled:opacity-60"
        >
          {loading ? "Loading..." : hasMore ? "Load more" : "No more"}
        </button>
      </div>
    </div>
  );
}
