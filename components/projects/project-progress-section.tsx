"use client";

import type { ProjectHealthStatus, ProjectHealthSummary, ProjectProgressSummary } from "@/types/models";

type ProjectProgressSectionProps = {
  progress: ProjectProgressSummary;
  health: ProjectHealthSummary;
  variant?: "default" | "compact";
};

function formatWindow(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "No project window set";
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  return startDate || endDate || "No timeline dates";
}

function pluralize(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function ProjectProgressSection({ progress, health, variant = "default" }: ProjectProgressSectionProps) {
  const isCompact = variant === "compact";
  const healthStyles: Record<ProjectHealthStatus, {
    badgeClassName: string;
    barClassName: string;
    textClassName: string;
  }> = {
    healthy: {
      badgeClassName: "project-progress-health-badge--healthy border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
      barClassName: "project-progress-bar--healthy bg-emerald-300",
      textClassName: "project-progress-health-text--healthy text-emerald-200",
    },
    watch: {
      badgeClassName: "project-progress-health-badge--watch border-amber-300/35 bg-amber-300/10 text-amber-200",
      barClassName: "project-progress-bar--watch bg-amber-300",
      textClassName: "project-progress-health-text--watch text-amber-200",
    },
    at_risk: {
      badgeClassName: "project-progress-health-badge--risk border-red-300/40 bg-red-400/10 text-red-200",
      barClassName: "project-progress-bar--risk bg-red-300",
      textClassName: "project-progress-health-text--risk text-red-200",
    },
  };

  const metricItems = [
    {
      label: "Overdue",
      value: progress.overdueTasks,
      detail: progress.overdueTasks > 0 ? "Past deadline" : "On schedule",
      className:
        progress.overdueTasks > 0
          ? "project-progress-card project-progress-card--overdue-active border-red-300/35 bg-red-400/10 text-red-100"
          : "project-progress-card project-progress-card--neutral border-white/10 bg-black/20 text-neutral-200",
      valueClassName: progress.overdueTasks > 0 ? "project-progress-value--overdue text-red-100" : "text-white",
    },
    {
      label: "Due soon",
      value: progress.dueSoonTasks,
      detail: "Next 7 days",
      className:
        progress.dueSoonTasks > 0
          ? "project-progress-card project-progress-card--warning-active border-amber-300/35 bg-amber-300/10 text-amber-100"
          : "project-progress-card project-progress-card--neutral border-white/10 bg-black/20 text-neutral-200",
      valueClassName: progress.dueSoonTasks > 0 ? "project-progress-value--warning text-amber-100" : "text-white",
    },
    {
      label: "Unassigned",
      value: progress.unassignedTasks,
      detail: progress.unassignedTasks > 0 ? "Needs owner" : "Owned work",
      className:
        progress.unassignedTasks > 0
          ? "project-progress-card project-progress-card--warning-active border-amber-300/35 bg-amber-300/10 text-amber-100"
          : "project-progress-card project-progress-card--neutral border-white/10 bg-black/20 text-neutral-200",
      valueClassName: progress.unassignedTasks > 0 ? "project-progress-value--warning text-amber-100" : "text-white",
    },
    {
      label: "In progress",
      value: progress.inProgressTasks,
      detail: "Active work",
      className: "project-progress-card project-progress-card--active border-sky-300/25 bg-sky-300/10 text-sky-100",
      valueClassName: "project-progress-value--active text-sky-100",
    },
    {
      label: "Done",
      value: progress.completedTasks,
      detail: "Completed",
      className: "project-progress-card project-progress-card--done border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
      valueClassName: "project-progress-value--done text-emerald-100",
    },
    {
      label: "Todo",
      value: progress.todoTasks,
      detail: "Not started",
      className: "project-progress-card project-progress-card--neutral border-white/10 bg-black/20 text-neutral-200",
      valueClassName: "text-white",
    },
  ];
  const healthStyle = healthStyles[health.status];
  const phasesCompleteText =
    progress.timelinePhaseCount === 0
      ? "No phases planned"
      : `${progress.completedTimelinePhases} of ${progress.timelinePhaseCount} phases complete`;

  return (
    <section className={`project-progress-panel app-frame rounded-2xl bg-white/5 ${isCompact ? "p-4" : "p-4 sm:p-5 md:p-6"}`}>
      <div className={isCompact ? "flex flex-col gap-3" : "flex flex-col gap-4 md:flex-row md:items-start md:justify-between"}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="project-progress-eyebrow text-xs font-semibold uppercase tracking-wide text-neutral-500">Project status</p>
            <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold ${healthStyle.badgeClassName}`}>
              {health.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <h2 className={`project-progress-percent font-semibold tracking-tight text-white ${isCompact ? "text-2xl" : "text-3xl"}`}>{progress.completionPercent}%</h2>
            <p className="project-progress-summary pb-1 text-sm text-neutral-400">
              {progress.completedTasks} of {pluralize(progress.totalTasks, "task")} complete
            </p>
          </div>
          <p className={`mt-2 text-sm font-medium ${healthStyle.textClassName}`}>{health.message}</p>
        </div>

        <div className={`project-progress-timeline min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-neutral-400 ${isCompact ? "" : "md:text-right"}`}>
          <p className="project-progress-timeline-primary truncate text-neutral-200">
            Current phase: <span className="project-progress-timeline-current font-semibold text-white">{progress.currentTimelinePhase || "No active phase"}</span>
          </p>
          <p className="mt-1 truncate">Project window: {formatWindow(progress.projectWindow.startDate, progress.projectWindow.endDate)}</p>
          <p className="mt-1">{phasesCompleteText}</p>
        </div>
      </div>

      <div className="project-progress-track mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${healthStyle.barClassName}`}
          style={{ width: `${progress.completionPercent}%` }}
        />
      </div>
      <div className="project-progress-meta mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span>Completion</span>
        <span>{progress.totalTasks === 0 ? "No tasks yet" : `${progress.totalTasks} tracked tasks`}</span>
      </div>

      <div className={`mt-4 grid gap-2 ${isCompact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>
        {metricItems.map((item) => (
          <div key={item.label} className={`rounded-lg border px-3 py-2 ${item.className}`}>
            <p className="project-progress-card-label text-xs font-medium text-current/70">{item.label}</p>
            <p className={`mt-1 text-xl font-semibold ${item.valueClassName}`}>{item.value}</p>
            <p className="project-progress-card-detail mt-0.5 truncate text-[11px] text-current/60">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
