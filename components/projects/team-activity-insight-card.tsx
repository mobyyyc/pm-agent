import type { ProjectTeamActivityInsight } from "@/types/models";

type TeamActivityInsightCardProps = {
  insight: ProjectTeamActivityInsight;
};

function pluralize(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatLastActivity(value: string | null): string {
  if (!value) return "No recent activity";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TeamActivityInsightCard({ insight }: TeamActivityInsightCardProps) {
  const hasActivity = Boolean(insight.lastActivityAt);
  const topContributorText =
    insight.topContributorName || (hasActivity ? "No attributed activity yet" : "No recent activity");
  const topContributorDetail =
    insight.topContributorActivityCount > 0
      ? pluralize(insight.topContributorActivityCount, "activity")
      : "Last 7 days";

  const metrics = [
    {
      label: "Activity this week",
      value: String(insight.activityCountLast7Days),
      detail: pluralize(insight.activityCountLast7Days, "event"),
      valueClassName: "text-lg",
    },
    {
      label: "Commits this week",
      value: String(insight.commitCountLast7Days),
      detail: pluralize(insight.commitCountLast7Days, "commit"),
      valueClassName: "text-lg",
    },
    {
      label: "Attributed activity",
      value: String(insight.attributedActivityCountLast7Days),
      detail: "Member-mapped events",
      valueClassName: "text-lg",
    },
    {
      label: "Top contributor",
      value: topContributorText,
      detail: topContributorDetail,
      valueClassName: "text-sm",
    },
  ];

  return (
    <section className="app-frame rounded-2xl bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-white">Team Activity</h2>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          7d
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Last activity</p>
        <p className="mt-1 min-w-0 truncate text-sm font-semibold text-white">{formatLastActivity(insight.lastActivityAt)}</p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {metrics.map((item) => (
          <div key={item.label} className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] font-medium text-neutral-500">{item.label}</p>
            <p className={`mt-1 min-h-6 break-words font-semibold leading-tight text-white ${item.valueClassName}`}>{item.value}</p>
            <p className="mt-0.5 truncate text-[11px] text-neutral-500">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
