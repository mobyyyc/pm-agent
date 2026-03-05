
"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
        Welcome Home
      </h1>
      <p className="mb-8 max-w-lg text-lg text-white/60">
        This is your dashboard. Select a project from the sidebar to view details, or start planning a new project.
      </p>
      <Link
        href="/projects/new"
        className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-black shadow-sm hover:bg-gray-200 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Plan New Project
      </Link>
    </div>
  );
}

