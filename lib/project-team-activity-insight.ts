import type { ProjectActivityEvent, ProjectTeamActivityInsight } from "@/types/models";

const LAST_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type ContributorStats = {
  count: number;
  displayName: string;
  latestAt: number;
};

function parseTime(value: string | Date): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(time)) {
    throw new Error("Invalid team activity insight reference time.");
  }
  return time;
}

function parseEventTime(event: ProjectActivityEvent): number | null {
  const time = new Date(event.createdAt).getTime();
  return Number.isNaN(time) ? null : time;
}

function metadataString(event: ProjectActivityEvent, key: "actorMemberId" | "actorMemberName"): string | null {
  const value = event.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getContributorKey(event: ProjectActivityEvent): string | null {
  const actorMemberId = metadataString(event, "actorMemberId");
  const actorMemberName = metadataString(event, "actorMemberName");

  if (actorMemberId) return `id:${actorMemberId}`;
  if (actorMemberName) return `name:${actorMemberName.toLowerCase()}`;
  return null;
}

function getContributorDisplayName(event: ProjectActivityEvent): string | null {
  return metadataString(event, "actorMemberName") || metadataString(event, "actorMemberId");
}

function isInLast7Days(eventTime: number, nowTime: number): boolean {
  return eventTime >= nowTime - LAST_7_DAYS_MS && eventTime <= nowTime;
}

export function calculateProjectTeamActivityInsight(
  activityEvents: ProjectActivityEvent[],
  now: string | Date,
): ProjectTeamActivityInsight {
  const nowTime = parseTime(now);
  const contributorStats = new Map<string, ContributorStats>();
  let lastActivityAt: string | null = null;
  let lastActivityTime = Number.NEGATIVE_INFINITY;
  let activityCountLast7Days = 0;
  let commitCountLast7Days = 0;
  let attributedActivityCountLast7Days = 0;

  for (const event of activityEvents) {
    const eventTime = parseEventTime(event);
    if (eventTime === null) continue;

    if (eventTime > lastActivityTime) {
      lastActivityTime = eventTime;
      lastActivityAt = event.createdAt;
    }

    if (!isInLast7Days(eventTime, nowTime)) continue;

    activityCountLast7Days += 1;
    if (event.entityType === "github_commit") {
      commitCountLast7Days += 1;
    }

    const contributorKey = getContributorKey(event);
    const displayName = getContributorDisplayName(event);
    if (!contributorKey || !displayName) continue;

    attributedActivityCountLast7Days += 1;
    const previousStats = contributorStats.get(contributorKey);
    contributorStats.set(contributorKey, {
      count: (previousStats?.count || 0) + 1,
      displayName: metadataString(event, "actorMemberName") || previousStats?.displayName || displayName,
      latestAt: Math.max(previousStats?.latestAt ?? Number.NEGATIVE_INFINITY, eventTime),
    });
  }

  const topContributor = [...contributorStats.values()].sort((first, second) => {
    if (second.count !== first.count) return second.count - first.count;
    if (second.latestAt !== first.latestAt) return second.latestAt - first.latestAt;
    return first.displayName.localeCompare(second.displayName);
  })[0];

  return {
    lastActivityAt,
    activityCountLast7Days,
    commitCountLast7Days,
    attributedActivityCountLast7Days,
    topContributorName: topContributor?.displayName || null,
    topContributorActivityCount: topContributor?.count || 0,
  };
}
