"use client";

import Link from "next/link";
import CodeRainBackground from "../components/CodeRainBackground";

export default function HomePage() {
  return (
    <div className="relative isolate flex min-h-[calc(100dvh-8rem)] w-full flex-col items-center justify-center overflow-hidden p-4 text-center sm:p-6 md:p-8">
      <CodeRainBackground />
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="home-hero-heading mb-4 bg-linear-to-b from-white to-transparent bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl">
          This page is under development...
        </h1>
        <p className="mb-8 max-w-lg text-base text-neutral-400 sm:text-lg md:text-xl">
          The dashboard is currently being built. Please check back later for updates.
        </p>
        
        <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
          <Link
            href="/projects/new"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-transparent bg-white px-6 text-sm font-semibold leading-none text-black shadow-lg transition-colors duration-200 hover:bg-white/90 sm:w-auto"
          >
            Create New Project
          </Link>
          <a
            href="https://github.com/mobyyyc/pm-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-6 text-sm font-semibold leading-none text-white transition-colors hover:border-white/40 sm:w-auto"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.57 7.57 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            View Github Repository
          </a>
        </div>
      </div>
    </div>
  );
}
