"use client";

import { useState } from "react";

import type { ProjectProgressReport, ProjectReportPeriod } from "@/types/models";

type ProjectReportSectionProps = {
  projectId: string;
  isGuest: boolean;
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

async function getResponseErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null;
  return body?.detail || body?.error || "Failed to generate report.";
}

function formatGeneratedTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

export function ProjectReportSection({ projectId, isGuest }: ProjectReportSectionProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<ProjectReportPeriod>("weekly");
  const [report, setReport] = useState<ProjectProgressReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (isGuest || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: selectedPeriod }),
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
      }

      const data = (await response.json()) as { report?: ProjectProgressReport };
      if (!data.report) {
        throw new Error("Report response was empty.");
      }

      setReport(data.report);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Failed to generate report.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="project-report-panel app-frame rounded-2xl bg-white/5 p-4 sm:p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="project-report-eyebrow">Reports</p>
          <h2 className="project-report-heading">Project Progress Report</h2>
          {isGuest ? (
            <p className="project-report-muted mt-2">Sign in to generate reports from project activity.</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="project-report-period-control inline-flex rounded-full p-1">
            {reportPeriods.map((period) => (
              <button
                key={period.value}
                type="button"
                onClick={() => setSelectedPeriod(period.value)}
                className={`project-report-period-button rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedPeriod === period.value ? "project-report-period-button--active" : ""
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateReport()}
            disabled={isGuest || isGenerating}
            className="key-button inline-flex h-9 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {error ? <div className="error-msg mt-4 px-4 py-2 text-sm font-semibold">{error}</div> : null}

      {report ? (
        <div className="mt-5 space-y-5">
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
      ) : (
        <p className="project-report-empty-state mt-4">No report generated for this project yet.</p>
      )}
    </section>
  );
}
