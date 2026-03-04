"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type CreateProjectResponse = {
  project?: { id: string };
  error?: string;
  detail?: string;
};

export default function HomePage() {
  const [idea, setIdea] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });

      const data = (await response.json()) as CreateProjectResponse;

      if (!response.ok || !data.project) {
        throw new Error(data.detail ?? data.error ?? "Failed to create project.");
      }

      setIdea("");
      router.push(`/projects/${data.project.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI PM Prototype</h1>
        <Link href="/projects" className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10">
          My Projects
        </Link>
      </header>

      <section className="rounded-lg border border-white/20 bg-white/5 p-4">
        <h2 className="text-lg font-medium">Create Project Plan</h2>
        <p className="mt-1 text-sm text-white/75">
          Enter a project idea. The backend will combine it with company knowledge and generate a plan with Gemini.
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <textarea
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            required
            minLength={5}
            rows={6}
            placeholder="Example: Build an onboarding assistant that reduces setup time for new customers."
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/45"
          />
          <button
            type="submit"
            disabled={isLoading || idea.trim().length < 5}
            className="w-fit rounded-md bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Generating..." : "Generate Plan"}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
