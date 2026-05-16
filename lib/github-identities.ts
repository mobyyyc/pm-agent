import type {
  GithubContributorIdentity,
  ProjectMember,
  ProjectMemberGithubIdentity,
} from "@/types/models";

function normalizeIdentityValue(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function contributorIdentityKey(contributor: GithubContributorIdentity): string {
  return (
    normalizeIdentityValue(contributor.githubLogin) ||
    normalizeIdentityValue(contributor.githubEmail) ||
    normalizeIdentityValue(contributor.githubName) ||
    "unknown"
  );
}

export function resolveGithubContributorFromMappings(
  mappings: ProjectMemberGithubIdentity[],
  members: ProjectMember[],
  contributor: GithubContributorIdentity,
): ProjectMember | null {
  const login = normalizeIdentityValue(contributor.githubLogin);
  const email = normalizeIdentityValue(contributor.githubEmail);
  const name = normalizeIdentityValue(contributor.githubName);

  const findMapping = (
    field: "githubLogin" | "githubEmail" | "githubName",
    value: string | null,
  ) => {
    if (!value) return null;

    return (
      mappings.find((mapping) => normalizeIdentityValue(mapping[field]) === value) || null
    );
  };

  const mapping =
    findMapping("githubLogin", login) ||
    findMapping("githubEmail", email) ||
    findMapping("githubName", name);

  if (!mapping) return null;

  return members.find((member) => member.userId === mapping.memberId) || null;
}
