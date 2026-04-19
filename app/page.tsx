"use client";

import Link from "next/link";
import CodeRainBackground from "../components/CodeRainBackground";

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] w-full flex-col items-center justify-center p-8 text-center relative overflow-hidden isolate">
      <CodeRainBackground />
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="home-hero-heading mb-4 bg-linear-to-b from-white to-transparent bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl">
          This page is under development...
        </h1>
        <p className="mb-8 max-w-lg text-xl text-neutral-400">
          The dashboard is currently being built. Please check back later for updates.
        </p>
        
        <div className="flex gap-4">
          <Link
            href="/projects/new"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all shadow-lg hover:bg-gray-200"
          >
            Create New Project
          </Link>
        </div>
      </div>
    </div>
  );
}
