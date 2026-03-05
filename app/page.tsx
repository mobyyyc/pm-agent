"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
        This page is under development...
      </h1>
      <p className="max-w-lg text-xl text-neutral-400">
        The dashboard is currently being built. Please check back later for updates.
      </p>
      
      <div className="flex gap-4">
        <Link
          href="/projects"
          className="rounded-lg bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all border border-white/10"
        >
          View Projects
        </Link>
        <Link
          href="/projects/new"
          className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-gray-200 transition-all shadow-lg"
        >
          Create New Project
        </Link>
      </div>
    </div>
  );
}
