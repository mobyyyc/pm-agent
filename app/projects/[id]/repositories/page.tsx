"use client";

import { createPortal } from "react-dom";
import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

import { useGuest } from "@/components/GuestContext";
import type { Project, ProjectRepository, RepositoryVisibility } from "@/types/models";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProjectResponse = {
  project?: Project;
};

type RepositoryResponse = {
  repository: ProjectRepository | null;
  canManage: boolean;
  github: {
    linked: boolean;
    login: string | null;
  };
};

type ApiErrorBody = {
  error?: string;
  issues?: string[];
};

type UnlinkAction = "unlink_only" | "unlink_and_delete";

function formatApiError(body: ApiErrorBody | null | undefined, fallback: string): string {
  if (!body) return fallback;
  if (Array.isArray(body.issues) && body.issues.length > 0) {
    return body.issues.join(" ");
  }
  return body.error || fallback;
}

export default function ProjectRepositoriesPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const { isGuest, getGuestProject } = useGuest();

  const [dbProject, setDbProject] = useState<Project | null>(null);
  const [repository, setRepository] = useState<ProjectRepository | null>(null);
  const [notFoundState, setNotFoundState] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [githubLinked, setGithubLinked] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [unlinkingAction, setUnlinkingAction] = useState<UnlinkAction | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isCreatingGithubRepo, setIsCreatingGithubRepo] = useState(false);

  const [manualOwnerLogin, setManualOwnerLogin] = useState("");
  const [manualRepoName, setManualRepoName] = useState("");
  const [manualHtmlUrl, setManualHtmlUrl] = useState("");
  const [manualDefaultBranch, setManualDefaultBranch] = useState("main");
  const [manualVisibility, setManualVisibility] = useState<RepositoryVisibility>("private");
  const [isMounted, setIsMounted] = useState(false);

  const [createRepoName, setCreateRepoName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createVisibility, setCreateVisibility] = useState<RepositoryVisibility>("private");

  const guestProjectBundle = isGuest ? getGuestProject(id) : null;
  const project = isGuest ? (guestProjectBundle?.project || null) : dbProject;

  const isPageLoading =
    sessionStatus === "loading" ||
    (!isGuest && !!session?.user?.email && !notFoundState && dbProject === null);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (isGuest) return;

    if (session?.user?.email) {
      Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/repository`, { cache: "no-store" }),
      ])
        .then(async ([projectRes, repositoryRes]) => {
          if (!projectRes.ok) {
            setNotFoundState(true);
            return;
          }

          const projectBody = (await projectRes.json()) as ProjectResponse;
          if (!projectBody?.project) {
            setNotFoundState(true);
            return;
          }

          setDbProject(projectBody.project);

          const repositoryBody = (await repositoryRes.json().catch(() => null)) as RepositoryResponse | { error?: string } | null;
          if (!repositoryRes.ok) {
            setLoadError(repositoryBody && "error" in repositoryBody ? repositoryBody.error || "Failed to load repository." : "Failed to load repository.");
            return;
          }

          const typedRepositoryBody = repositoryBody as RepositoryResponse;
          setRepository(typedRepositoryBody.repository || null);
          setCanManage(typedRepositoryBody.canManage);
          setGithubLinked(typedRepositoryBody.github.linked);
          setGithubLogin(typedRepositoryBody.github.login);
        })
        .catch(() => setNotFoundState(true));
    }
  }, [id, isGuest, session?.user?.email, sessionStatus]);

  useEffect(() => {
    if (!repository) {
      setManualOwnerLogin(githubLogin || "");
      return;
    }

    setManualOwnerLogin(repository.ownerLogin);
    setManualRepoName(repository.repoName);
    setManualHtmlUrl(repository.htmlUrl);
    setManualDefaultBranch(repository.defaultBranch);
    setManualVisibility(repository.visibility);
  }, [repository, githubLogin]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (isPageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading repositories...</p>
      </div>
    );
  }

  const isUnauthedUser = !isGuest && !session?.user?.email;
  const isGuestNotFound = isGuest && !guestProjectBundle;

  if (notFoundState || !project || isGuestNotFound || isUnauthedUser) {
    notFound();
  }

  const handleManualLinkSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setActionError(null);
    setActionSuccess(null);

    const normalizedOwner = manualOwnerLogin.trim();
    const normalizedRepo = manualRepoName.trim();
    const normalizedUrl = manualHtmlUrl.trim();
    const normalizedBranch = manualDefaultBranch.trim();

    if (!normalizedOwner || !normalizedRepo || !normalizedUrl || !normalizedBranch) {
      setActionError("Owner, repository name, URL, and default branch are required.");
      return;
    }

    setIsSavingManual(true);

    try {
      const response = await fetch(`/api/projects/${id}/repository`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerLogin: normalizedOwner,
          repoName: normalizedRepo,
          htmlUrl: normalizedUrl,
          defaultBranch: normalizedBranch,
          visibility: manualVisibility,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        repository?: ProjectRepository;
        error?: string;
        issues?: string[];
      };

      if (!response.ok || !body.repository) {
        throw new Error(formatApiError(body, "Failed to save repository settings."));
      }

      setRepository(body.repository);
      setActionSuccess("Repository settings saved.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save repository settings.");
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleCreateGithubRepository = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setActionError(null);
    setActionSuccess(null);

    const normalizedRepoName = createRepoName.trim();
    if (!normalizedRepoName) {
      setActionError("Repository name is required.");
      return;
    }

    if (!githubLogin) {
      setActionError("Linked Github login is missing. Refresh this page and try again.");
      return;
    }

    setIsCreatingGithubRepo(true);

    try {
      const response = await fetch(`/api/projects/${id}/repository`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerLogin: githubLogin,
          repoName: normalizedRepoName,
          description: createDescription.trim(),
          visibility: createVisibility,
          autoInit: true,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        repository?: ProjectRepository;
        error?: string;
        issues?: string[];
      };

      if (!response.ok || !body.repository) {
        throw new Error(formatApiError(body, "Failed to create Github repository."));
      }

      setRepository(body.repository);
      setManualOwnerLogin(body.repository.ownerLogin);
      setManualRepoName(body.repository.repoName);
      setManualHtmlUrl(body.repository.htmlUrl);
      setManualDefaultBranch(body.repository.defaultBranch);
      setManualVisibility(body.repository.visibility);
      setCreateRepoName("");
      setCreateDescription("");
      setActionSuccess("Github repository created and linked to this project.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create Github repository.");
    } finally {
      setIsCreatingGithubRepo(false);
    }
  };

  const handleOpenUnlinkModal = () => {
    setActionError(null);
    setActionSuccess(null);
    setIsUnlinkModalOpen(true);
  };

  const handleCloseUnlinkModal = () => {
    if (unlinkingAction) return;
    setIsUnlinkModalOpen(false);
  };

  const handleUnlinkRepository = async (action: UnlinkAction) => {
    setActionError(null);
    setActionSuccess(null);
    setUnlinkingAction(action);

    try {
      const response = await fetch(`/api/projects/${id}/repository`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        deletedGithubRepository?: boolean;
        error?: string;
        issues?: string[];
      };

      if (!response.ok || !body.success) {
        throw new Error(formatApiError(body, "Failed to unlink repository."));
      }

      setRepository(null);
      setGithubLinked(Boolean(githubLogin));
      setCreateRepoName("");
      setCreateDescription("");
      setManualOwnerLogin(githubLogin || "");
      setManualRepoName("");
      setManualHtmlUrl("");
      setManualDefaultBranch("main");
      setManualVisibility("private");
      setActionSuccess(
        body.deletedGithubRepository
          ? "Repository unlinked and Github repo deleted."
          : "Repository unlinked. The Github repo still exists.",
      );
      setIsUnlinkModalOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to unlink repository.");
    } finally {
      setUnlinkingAction(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-3 py-6 sm:px-4 sm:py-8 md:gap-8 md:px-6 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Repositories</h1>
        <p className="max-w-2xl text-base leading-relaxed text-neutral-400">
          Connect or create a repository for this project.
        </p>
        <p className="text-sm text-neutral-500">Project: {project.name || project.idea}</p>
      </header>

      {isGuest ? (
        <section className="app-frame app-frame-hover rounded-2xl border border-amber-200/25 bg-amber-100/5 p-6 transition-colors">
          <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">Sign In Required</h2>
          <p className="text-sm text-neutral-300">
            Repository management requires a signed-in account. Guest projects cannot create or link remote repositories.
          </p>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: `/projects/${id}/repositories` })}
            className="key-button mt-5 cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition-colors"
          >
            Sign in to Manage Repositories
          </button>
        </section>
      ) : null}

      {!isGuest && repository ? (
        <section className="app-frame app-frame-hover rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors">
          <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">Current Repository</h2>
          <div className="space-y-1 text-sm text-neutral-300">
            <p>
              <span className="text-neutral-400">Full name:</span> {repository.fullName}
            </p>
            <p>
              <span className="text-neutral-400">URL:</span>{" "}
              <a className="text-blue-300 underline-offset-2 hover:underline" href={repository.htmlUrl} target="_blank" rel="noreferrer">
                {repository.htmlUrl}
              </a>
            </p>
            <p>
              <span className="text-neutral-400">Visibility:</span> {repository.visibility}
            </p>
            <p>
              <span className="text-neutral-400">Default branch:</span> {repository.defaultBranch}
            </p>
          </div>
          {loadError ? <p className="mt-3 text-sm text-red-400">{loadError}</p> : null}
          {actionError ? <p className="mt-3 text-sm text-red-400">{actionError}</p> : null}
          {actionSuccess ? <p className="mt-3 text-sm text-green-400">{actionSuccess}</p> : null}
          {canManage ? (
            <button
              type="button"
              onClick={handleOpenUnlinkModal}
              className="normal-button mt-4 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            >
              Unlink Repo
            </button>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">Only the project owner can change repository settings.</p>
          )}
        </section>
      ) : null}

      {!isGuest && canManage && !repository ? (
        <section className="grid gap-6 md:grid-cols-2">
          <form
            onSubmit={(event) => void handleCreateGithubRepository(event)}
            className="app-frame app-frame-hover rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors"
          >
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">Create in Github</h2>
            {githubLinked ? (
              <p className="mb-3 text-xs text-neutral-400">Creating under @{githubLogin}</p>
            ) : (
              <p className="mb-3 text-xs text-amber-300">Link your Github account in Settings to create repos.</p>
            )}
            <div className="space-y-3">
              <input
                value={createRepoName}
                onChange={(event) => setCreateRepoName(event.target.value)}
                placeholder="Repository name (letters, numbers, ., _, -)"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-neutral-500 focus:border-white/30"
              />
              <textarea
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder="Description (optional)"
                className="min-h-20 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-neutral-500 focus:border-white/30"
              />
              <select
                value={createVisibility}
                onChange={(event) => setCreateVisibility(event.target.value as RepositoryVisibility)}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-white/30"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <button
                type="submit"
                disabled={!githubLinked || isCreatingGithubRepo}
                className="key-button cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingGithubRepo ? "Creating..." : "Create and Link Repository"}
              </button>
            </div>
          </form>

          <form
            onSubmit={(event) => void handleManualLinkSubmit(event)}
            className="app-frame app-frame-hover rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors"
          >
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">Link Existing Repository</h2>
            <div className="space-y-3">
              <input
                value={manualOwnerLogin}
                onChange={(event) => setManualOwnerLogin(event.target.value)}
                placeholder="Owner login"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-neutral-500 focus:border-white/30"
              />
              <input
                value={manualRepoName}
                onChange={(event) => setManualRepoName(event.target.value)}
                placeholder="Repository name"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-neutral-500 focus:border-white/30"
              />
              <input
                value={manualHtmlUrl}
                onChange={(event) => setManualHtmlUrl(event.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-neutral-500 focus:border-white/30"
              />
              <input
                value={manualDefaultBranch}
                onChange={(event) => setManualDefaultBranch(event.target.value)}
                placeholder="Default branch"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-neutral-500 focus:border-white/30"
              />
              <select
                value={manualVisibility}
                onChange={(event) => setManualVisibility(event.target.value as RepositoryVisibility)}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-white/30"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <button
                type="submit"
                disabled={isSavingManual}
                className="normal-button cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingManual ? "Saving..." : "Save Repository Link"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {isMounted && isUnlinkModalOpen
        ? createPortal(
            <div className="popup-backdrop">
              <div className="popup-window app-frame">
                <h2 className="text-xl font-semibold text-white">Unlink Repository</h2>
                <p className="mt-3 text-sm text-neutral-400">
                  Choose whether to keep the Github repository or delete it as well. This only affects the current project link unless you choose the delete option.
                </p>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => void handleUnlinkRepository("unlink_only")}
                    disabled={unlinkingAction !== null}
                    className="normal-button flex w-full cursor-pointer flex-col items-start rounded-xl px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="text-sm font-semibold text-white">Unlink only</span>
                    <span className="mt-1 text-xs text-neutral-400">Remove the repository from this project. The Github repo will still exist.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleUnlinkRepository("unlink_and_delete")}
                    disabled={unlinkingAction !== null}
                    className="app-destructive-button flex w-full cursor-pointer flex-col items-start rounded-xl px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="text-sm font-semibold text-current">Unlink and delete repo</span>
                    <span className="mt-1 text-xs text-current/80">Remove the project link and permanently delete the Github repository.</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseUnlinkModal}
                    disabled={unlinkingAction !== null}
                    className="sub-button flex w-full cursor-pointer flex-col items-start rounded-xl px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="text-sm font-semibold text-white">Cancel</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </main>
  );
}
