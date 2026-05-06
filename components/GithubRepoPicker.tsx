"use client";

import { useEffect, useState } from "react";
import type { ProjectRepository } from "@/types/models";

type RepoItem = {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
};

type LinkRepositoryResponse = {
  repository?: ProjectRepository;
  error?: string;
  message?: string;
};

export default function GithubRepoPicker({
  projectId,
  onLinked,
}: {
  projectId: string;
  onLinked: (repo: ProjectRepository) => void;
}) {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/repository/github-repos?page=${page}&per_page=50`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body && (body.error || body.message)) || `Status ${res.status}`);
        }
        const body = await res.json();
        if (cancelled) return;
        setRepos((prev) => (page === 1 ? body.repos : prev.concat(body.repos)));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load repos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, page]);

  async function handleLink(repo: RepoItem) {
    setError(null);
    try {
      const payload = {
        provider: "github",
        ownerLogin: repo.fullName.split("/")[0],
        repoName: repo.name,
        htmlUrl: repo.htmlUrl,
        defaultBranch: repo.defaultBranch || "main",
        visibility: repo.private ? "private" : "public",
        externalId: `github:${repo.id}`,
      };

      const res = await fetch(`/api/projects/${projectId}/repository`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as LinkRepositoryResponse;
      if (!res.ok || !body.repository) {
        throw new Error((body && (body.error || body.message)) || `Status ${res.status}`);
      }

      onLinked(body.repository);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link repository.");
    }
  }

  return (
    <div className="app-frame app-frame-hover rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors">
      <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">Link Existing Github Repository</h2>
      {error ? <div className="error-msg mb-3 px-3 py-2 text-sm font-semibold">{error}</div> : null}

      {loading && repos.length === 0 ? (
        <p className="text-sm text-neutral-400">Loading repositories...</p>
      ) : repos.length === 0 ? (
        <p className="text-sm text-neutral-400">No repositories found for your Github account.</p>
      ) : (
        <ul className="grid gap-3">
          {repos.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/6 bg-black/20 p-3">
              <div>
                <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-white hover:underline">
                  {r.fullName}
                </a>
                <div className="mt-1 text-xs text-neutral-400">{r.description}</div>
                <div className="mt-1 text-xs text-neutral-500">Default branch: {r.defaultBranch}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleLink(r)}
                  className="key-button rounded-full px-3 py-1 text-sm"
                >
                  Link
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
          disabled={loading}
          onClick={() => setPage((p) => p + 1)}
          className="key-button rounded-full px-3 py-1 text-sm disabled:opacity-60"
        >
          {loading ? "Loading..." : "More"}
        </button>
      </div>
    </div>
  );
}
