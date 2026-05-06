"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  BoltIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  ListBulletIcon,
  NewspaperIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import CodeRainBackground from "../components/CodeRainBackground";

const GITHUB_REPO_URL = "https://github.com/mobyyyc/pm-agent";

const workflowSteps = [
  {
    title: "Plan",
    description: "Convert a rough brief into milestones, timelines, and the first practical delivery shape.",
    Icon: FlagIcon,
  },
  {
    title: "Execute",
    description: "Break milestones into tasks, ownership, deadlines, and status updates your team can act on.",
    Icon: ListBulletIcon,
  },
  {
    title: "Monitor",
    description: "Track progress, repository activity, blockers, deadlines, and critical project windows.",
    Icon: ExclamationTriangleIcon,
  },
  {
    title: "Report",
    description: "Use agents to support daily, weekly, or monthly summaries and reminder workflows.",
    Icon: NewspaperIcon,
  },
];

const capabilities = [
  {
    label: "AI milestone planning",
    description: "Turn messy briefs into structured phases, dates, and outcomes.",
    Icon: SparklesIcon,
  },
  {
    label: "Task ownership",
    description: "Generate and edit actionable work with assignees, deadlines, and statuses.",
    Icon: ListBulletIcon,
  },
  {
    label: "Progress tracking",
    description: "Keep project state visible across timelines, tasks, and repository activity.",
    Icon: CheckCircleIcon,
  },
  {
    label: "Automated reports",
    description: "Configure agents for recurring project digests and PM summaries.",
    Icon: NewspaperIcon,
  },
  {
    label: "Deadline alerts",
    description: "Surface upcoming dates, overdue work, and delivery-risk moments.",
    Icon: CalendarDaysIcon,
  },
  {
    label: "GitHub and team context",
    description: "Connect repo signal with team constraints, stack, and operating style.",
    Icon: UserGroupIcon,
  },
];

const previewItems = [
  {
    label: "Milestone timeline",
    value: "Discovery -> Build -> Launch",
    tone: "text-sky-300",
  },
  {
    label: "Task distribution",
    value: "8 tasks across design, API, QA",
    tone: "text-emerald-300",
  },
  {
    label: "Progress report",
    value: "Weekly summary ready for review",
    tone: "text-violet-300",
  },
  {
    label: "Deadline risk alert",
    value: "2 tasks due inside 72 hours",
    tone: "text-amber-300",
  },
  {
    label: "GitHub signal",
    value: "Recent commits attached to project",
    tone: "text-neutral-200",
  },
];

export default function HomePage() {
  return (
    <div className="app-shell-bleed relative isolate min-h-full w-full overflow-hidden">
      <CodeRainBackground />

      <main className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 md:px-8 md:py-12">
        <section className="grid items-center gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="flex flex-col items-start text-left">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-300">
              <BoltIcon className="h-4 w-4" aria-hidden="true" />
              VERSOR.AI PM workspace
            </div>

            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Turn rough ideas into managed project execution.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
              VERSOR.AI helps you create milestones, distribute tasks, track progress, and reduce repetitive PM
              coordination with reports, reminders, team context, and GitHub signal.
            </p>

            <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <Link
                href="/projects/new"
                className="key-button inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold leading-none shadow-lg transition-colors duration-200"
              >
                Create project
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/settings"
                className="sub-button inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold leading-none"
              >
                Add team context
              </Link>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="sub-button inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold leading-none"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.57 7.57 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8Z" />
                </svg>
                View GitHub
              </a>
            </div>

            <p className="mt-4 text-sm text-neutral-500">
              Open an existing project from the sidebar to continue planning, editing, monitoring, or reviewing delivery.
            </p>
          </div>

          <div className="app-frame rounded-2xl bg-white/5 p-5 text-left">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Operational preview</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Launch readiness board</h2>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Active
              </span>
            </div>

            <div className="relative mt-5 space-y-3">
              {previewItems.map((item) => (
                <div key={item.label} className="app-frame-item rounded-xl p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{item.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-neutral-200">{item.value}</p>
                    </div>
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-current ${item.tone}`} aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
              {["3 milestones", "8 open tasks", "1 risk window"].map((metric) => (
                <div key={metric} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-xs font-semibold text-neutral-300">{metric}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowSteps.map(({ title, description, Icon }, index) => (
            <div key={title} className="app-frame app-frame-hover rounded-2xl bg-white/5 p-5 text-left transition-colors">
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-5 w-5 text-neutral-200" aria-hidden="true" />
                <p className="text-sm font-semibold text-neutral-500">0{index + 1}</p>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{description}</p>
            </div>
          ))}
        </section>

        <section className="app-frame rounded-2xl bg-white/5 p-5 sm:p-6">
          <div className="flex flex-col gap-2 text-left sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Operational surface</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Built around the coordination work PMs repeat</h2>
            </div>
            <Link href="/agents/browse" className="sub-button inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold">
              Browse agents
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ label, description, Icon }) => (
              <div key={label} className="app-frame-item app-frame-hover rounded-xl p-4 text-left transition-colors">
                <Icon className="h-5 w-5 text-neutral-200" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold text-white">{label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
