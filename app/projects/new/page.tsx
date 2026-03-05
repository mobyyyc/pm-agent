
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CreateProjectResponse = {
  project?: { id: string };
  error?: string;
  detail?: string;
};

export default function CreateProjectPage() {
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
      // Force a hard navigation to refresh the sidebar
      window.location.href = `/projects/${data.project.id}`;
      // router.push(`/projects/${data.project.id}`); 
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8">
      <section className="w-full max-w-lg rounded-lg bg-white/5 p-6">
        <h1 className="mb-2 text-2xl font-bold">New Project Plan</h1>
        <p className="mb-6 text-sm text-neutral-400">
          Enter a project idea. The AI will generate a plan for you.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <textarea
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            required
            minLength={5}
            rows={6}
            placeholder="Describe your project idea in detail..."
            className="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button
            type="submit"
            disabled={isLoading || idea.trim().length < 5}
            className="w-fit rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/50"
          >
            {isLoading ? "Generating Plan..." : "Generate Plan"}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </form>
      </section>
    </div>
  );
}
