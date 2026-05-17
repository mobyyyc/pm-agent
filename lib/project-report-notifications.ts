import { sendProjectReportGeneratedEmail } from "@/lib/notifications";
import { getProjectMembers, insertProjectReport } from "@/lib/storage";
import { notificationRecipientSchema, type Project, type ProjectReportArtifact } from "@/types/models";

type ScheduledProjectReportNotificationDependencies = {
  getProjectMembers: typeof getProjectMembers;
  sendProjectReportGeneratedEmail: typeof sendProjectReportGeneratedEmail;
};

function getProjectMemberNotificationRecipients(members: Awaited<ReturnType<typeof getProjectMembers>>) {
  const seen = new Set<string>();
  return members.flatMap((member) => {
    const parsed = notificationRecipientSchema.safeParse({
      email: member.userId,
      userId: member.userId,
    });
    if (!parsed.success) return [];

    const normalizedEmail = parsed.data.email.toLowerCase();
    if (seen.has(normalizedEmail)) return [];
    seen.add(normalizedEmail);
    return [{ ...parsed.data, email: normalizedEmail }];
  });
}

export async function sendScheduledProjectReportNotifications(
  input: {
    project: Project;
    report: ProjectReportArtifact;
  },
  dependencies: Partial<ScheduledProjectReportNotificationDependencies> = {},
): Promise<void> {
  if (input.report.source !== "scheduled") {
    return;
  }

  const deps: ScheduledProjectReportNotificationDependencies = {
    getProjectMembers: dependencies.getProjectMembers || getProjectMembers,
    sendProjectReportGeneratedEmail: dependencies.sendProjectReportGeneratedEmail || sendProjectReportGeneratedEmail,
  };

  try {
    const members = await deps.getProjectMembers(input.project.id);
    const recipients = getProjectMemberNotificationRecipients(members);
    if (recipients.length === 0) {
      return;
    }

    await deps.sendProjectReportGeneratedEmail({
      project: input.project,
      report: input.report,
      recipients,
    });
  } catch (error) {
    console.error("Scheduled report email notification failed", error);
  }
}

export async function insertScheduledProjectReportWithNotifications(
  input: Parameters<typeof insertProjectReport>[0] & { source: "scheduled"; project: Project },
): Promise<ProjectReportArtifact> {
  const { project, ...reportInput } = input;
  const savedReport = await insertProjectReport(reportInput);
  await sendScheduledProjectReportNotifications({ project, report: savedReport });
  return savedReport;
}
