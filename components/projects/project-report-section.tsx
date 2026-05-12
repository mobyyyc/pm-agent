"use client";

import type { ProjectProgressReport, ProjectReportArtifact, ProjectReportPeriod } from "@/types/models";

type ProjectReportSectionProps = {
  isGuest: boolean;
  selectedPeriod: ProjectReportPeriod;
  report: ProjectProgressReport | null;
  isGenerating: boolean;
  error: string | null;
  reportHistory?: ProjectReportArtifact[];
  selectedReportId?: string | null;
  onPeriodChange: (period: ProjectReportPeriod) => void;
  onGenerate: () => void;
  onReportSelect?: (report: ProjectReportArtifact) => void;
  variant?: "full" | "controls" | "preview";
};

const reportPeriods: Array<{ value: ProjectReportPeriod; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const periodTitles: Record<ProjectReportPeriod, string> = {
  daily: "Daily Operational Summary",
  weekly: "Weekly Operational Summary",
  monthly: "Monthly Operational Summary",
};

function formatGeneratedTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatWindowDate(date: Date): string {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getReportWindow(report: ProjectProgressReport): string {
  const end = new Date(report.generatedAt);
  if (Number.isNaN(end.getTime())) return report.period;

  const start = new Date(end);
  if (report.period === "weekly") {
    start.setDate(start.getDate() - 6);
  } else if (report.period === "monthly") {
    start.setDate(start.getDate() - 29);
  }

  if (report.period === "daily") {
    return formatWindowDate(end);
  }

  return `${formatWindowDate(start)} - ${formatWindowDate(end)}`;
}

function getSeverityClass(priority: ProjectProgressReport["suggestedNextActions"][number]["priority"]): string {
  if (priority === "critical") return "project-report-severity--critical";
  if (priority === "warning") return "project-report-severity--warning";
  return "project-report-severity--info";
}

function ReportList({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "risk" }) {
  return (
    <div className="project-report-section-block">
      <h3 className="project-report-section-title">{title}</h3>
      {items.length === 0 ? (
        <p className="project-report-empty-state">No movement recorded for this period.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item} className={`project-report-list-item ${tone === "risk" ? "project-report-list-item--risk" : ""}`}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProjectReportSection({
  isGuest,
  selectedPeriod,
  report,
  isGenerating,
  error,
  reportHistory = [],
  selectedReportId = null,
  onPeriodChange,
  onGenerate,
  onReportSelect,
  variant = "full",
}: ProjectReportSectionProps) {
  const isControlsOnly = variant === "controls";
  const isPreviewOnly = variant === "preview";
  const showControls = variant === "full" || isControlsOnly;
  const showPreview = variant === "full" || isPreviewOnly;

  return (
    <section className={`project-report-panel app-frame rounded-2xl bg-white/5 ${isControlsOnly ? "p-4" : "p-4 sm:p-5 md:p-6"}`}>
      {showControls ? (
        <div className={`flex flex-col gap-4 ${isControlsOnly ? "" : "md:flex-row md:items-start md:justify-between"}`}>
          <div>
            <p className="project-report-eyebrow">Reports</p>
            <h2 className={`project-report-heading ${isControlsOnly ? "project-report-heading--compact" : ""}`}>
              {isControlsOnly ? "Report Actions" : "Project Progress Report"}
            </h2>
            {isGuest ? (
              <p className="project-report-muted mt-2">Sign in to generate reports from project activity.</p>
            ) : report && isControlsOnly ? (
              <p className="project-report-muted mt-2">Last generated {formatGeneratedTime(report.generatedAt)}</p>
            ) : null}
          </div>

          <div className={`flex flex-col gap-3 ${isControlsOnly ? "" : "sm:flex-row sm:items-center"}`}>
            <div
              className="relative flex h-8 w-full min-w-0 max-w-full flex-nowrap overflow-hidden rounded-full bg-white/15 p-1"
              role="tablist"
              aria-label="Report period"
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-1 rounded-full bg-white transition-[left,right] duration-300 ease-in-out ${
                  selectedPeriod === "daily"
                    ? "left-1 right-[calc(66.666667%+0.125rem)]"
                    : selectedPeriod === "weekly"
                      ? "left-[calc(33.333333%+0.125rem)] right-[calc(33.333333%+0.125rem)]"
                      : "left-[calc(66.666667%+0.125rem)] right-1"
                }`}
              />
              {reportPeriods.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  role="tab"
                  aria-selected={selectedPeriod === period.value}
                  onClick={() => onPeriodChange(period.value)}
                  className={`relative z-10 flex-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold transition-colors duration-300 ease-in-out ${
                    selectedPeriod === period.value ? "text-black" : "text-white/80 hover:text-white"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGuest || isGenerating}
              className="key-button inline-flex h-9 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      ) : null}

      {showControls && error ? <div className="error-msg mt-4 px-4 py-2 text-sm font-semibold">{error}</div> : null}

      {showControls && reportHistory.length > 0 ? (
        <div className="project-report-history mt-4">
          <p className="project-report-history-title">Saved Reports</p>
          <ul className="mt-2 space-y-2">
            {reportHistory.map((artifact) => {
              const isSelected = selectedReportId === artifact.id;
              return (
                <li key={artifact.id}>
                  <button
                    type="button"
                    onClick={() => onReportSelect?.(artifact)}
                    className={`project-report-history-item ${isSelected ? "project-report-history-item--active" : ""}`}
                    aria-pressed={isSelected}
                  >
                    <span className="project-report-history-main">
                      <span className="project-report-history-period">{artifact.period}</span>
                      <span className="project-report-history-time">{formatGeneratedTime(artifact.generatedAt)}</span>
                    </span>
                    <span className="project-report-history-meta">
                      <span>{artifact.inputSnapshot.health.label}</span>
                      {artifact.createdByUserId ? <span>{artifact.createdByUserId}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {showPreview && report ? (
        <div className={`${showControls ? "mt-5" : ""} space-y-5`}>
          <div className="project-report-summary-card rounded-xl p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="project-report-artifact-label">{periodTitles[report.period]}</p>
                <h3 className="project-report-project-name">{report.projectName}</h3>
              </div>
              <div className="project-report-meta">
                <p className="project-report-window">{getReportWindow(report)}</p>
                <p className="project-report-generated">Generated {formatGeneratedTime(report.generatedAt)}</p>
              </div>
            </div>
            <p className="project-report-executive-summary">{report.executiveSummary}</p>
            <p className="project-report-progress-copy">{report.progressOverview}</p>
            <p className="project-report-risk-callout">{report.healthExplanation}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ReportList title="Completed Work" items={report.completedWork} />
            <ReportList title="In Progress" items={report.inProgressWork} />
            <ReportList title="Risky Work" items={report.riskyWork} tone="risk" />
            <ReportList title="Activity Highlights" items={report.activityHighlights} />
          </div>

          <div className="project-report-section-block">
            <h3 className="project-report-section-title">Suggested Next Actions</h3>
            <ul className="mt-2 space-y-2">
              {report.suggestedNextActions.map((action) => (
                <li key={`${action.priority}-${action.title}`} className="project-report-action-item">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <p className="project-report-action-title">{action.title}</p>
                    <span className={`project-report-severity-badge ${getSeverityClass(action.priority)}`}>
                      {action.priority}
                    </span>
                  </div>
                  <p className="project-report-action-rationale">{action.rationale}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : showPreview ? (
        <p className="project-report-empty-state mt-4">No report generated for this project yet.</p>
      ) : null}
    </section>
  );
}
