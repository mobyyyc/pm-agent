"use client";

import type { ProjectProgressSummary } from "@/types/models";

type ProjectProgressSectionProps = {
  progress: ProjectProgressSummary;
};

function formatWindow(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "No timeline dates";
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  return startDate || endDate || "No timeline dates";
}

export function ProjectProgressSection({ progress }: ProjectProgressSectionProps) {
  const metricItems = [
    { label: "Done", value: progress.completedTasks },
    { label: "In progress", value: progress.inProgressTasks },
    { label: "Todo", value: progress.todoTasks },
    { label: "Overdue", value: progress.overdueTasks },
    { label: "Due soon", value: progress.dueSoonTasks },
    { label: "Unassigned", value: progress.unassignedTasks },
  ];

  return (
    <section className="app-frame rounded-2xl bg-white/5 p-4 sm:p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Progress</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <h2 className="text-3xl font-semibold tracking-tight text-white">{progress.completionPercent}%</h2>
            <p className="pb-1 text-sm text-neutral-400">
              {progress.completedTasks} of {progress.totalTasks} tasks complete
            </p>
          </div>
        </div>

        <div className="min-w-0 text-sm text-neutral-400 md:text-right">
          <p className="truncate text-neutral-300">
            Current phase: {progress.currentTimelinePhase || "None active"}
          </p>
          <p className="mt-1 truncate">
            Window: {formatWindow(progress.projectWindow.startDate, progress.projectWindow.endDate)}
          </p>
          <p className="mt-1">
            Timeline: {progress.completedTimelinePhases} of {progress.timelinePhaseCount} phases elapsed
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-300 transition-[width] duration-300"
          style={{ width: `${progress.completionPercent}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {metricItems.map((item) => (
          <div key={item.label} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-xs text-neutral-500">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
