import {
  notificationRecipientSchema,
  type NotificationDelivery,
  type NotificationEventType,
  type NotificationRecipient,
  type Project,
  type ProjectReportArtifact,
  type SendEmailNotificationInput,
} from "../../types/models";

type NotificationInput = {
  projectId?: string | null;
  userId?: string | null;
  recipient: NotificationRecipient;
  eventType: NotificationEventType;
  subject: string;
  body: string;
};

export type NotificationServiceDependencies = {
  createDelivery(input: {
    projectId: string | null;
    userId: string | null;
    recipientEmail: string;
    channel: "email";
    eventType: NotificationEventType;
    subject: string;
    bodyPreview: string;
    createdAt: string;
  }): Promise<NotificationDelivery>;
  markSent(id: string, providerMessageId: string | null): Promise<NotificationDelivery | null>;
  markFailed(id: string, errorMessage: string): Promise<NotificationDelivery | null>;
  sendEmail(input: SendEmailNotificationInput): Promise<string | null>;
  now(): string;
};

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    if (error.name === "EmailConfigurationError") {
      return error.message.slice(0, 500);
    }
    return "Email notification failed.";
  }
  return "Email notification failed.";
}

function getBodyPreview(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 500);
}

export function buildProjectReportGeneratedEmailBody(project: Project, report: ProjectReportArtifact): string {
  const lines = [
    `A new scheduled VERSOR project report is ready for ${project.name}.`,
    "",
    `Project: ${project.name}`,
    `Report created: ${report.createdAt}`,
  ];
  const health = report.inputSnapshot.health;
  const progress = report.inputSnapshot.progress;
  const comparisonSummary = report.inputSnapshot.comparisonSummary;

  if (health) {
    lines.push(`Health: ${health.label} (${health.status})`);
  }
  if (progress) {
    lines.push(`Progress: ${progress.completionPercent}% complete`);
  }
  if (comparisonSummary?.notableChanges?.length) {
    lines.push("", "Changes since previous report:");
    comparisonSummary.notableChanges.forEach((change) => lines.push(`- ${change}`));
  }

  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (baseUrl) {
    lines.push("", `Open report: ${baseUrl.replace(/\/$/, "")}/projects/${project.id}`);
  }

  return lines.join("\n");
}

export function buildLoginInfoEmailBody(input: {
  email: string;
  displayName?: string | null;
  loggedInAt: string;
}): string {
  const lines = [
    "You successfully logged in to VERSOR PM Agent.",
    "",
    `Account: ${input.displayName ? `${input.displayName} <${input.email}>` : input.email}`,
    `Login time: ${input.loggedInAt}`,
  ];

  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (baseUrl) {
    lines.push("", `Open VERSOR PM Agent: ${baseUrl.replace(/\/$/, "")}`);
  }

  return lines.join("\n");
}

export function createNotificationService(dependencies: NotificationServiceDependencies) {
  async function sendNotification(input: NotificationInput): Promise<NotificationDelivery | null> {
    const recipient = notificationRecipientSchema.parse(input.recipient);
    const delivery = await dependencies.createDelivery({
      projectId: input.projectId || null,
      userId: recipient.userId || input.userId || null,
      recipientEmail: recipient.email,
      channel: "email",
      eventType: input.eventType,
      subject: input.subject,
      bodyPreview: getBodyPreview(input.body),
      createdAt: dependencies.now(),
    });

    try {
      const providerMessageId = await dependencies.sendEmail({
        to: recipient.email,
        subject: input.subject,
        text: input.body,
      });
      return await dependencies.markSent(delivery.id, providerMessageId);
    } catch (error) {
      return await dependencies.markFailed(delivery.id, getSafeErrorMessage(error));
    }
  }

  async function sendProjectReportGeneratedEmail(input: {
    project: Project;
    report: ProjectReportArtifact;
    recipients: NotificationRecipient[];
  }): Promise<NotificationDelivery[]> {
    const subject = `New VERSOR report: ${input.project.name}`;
    const body = buildProjectReportGeneratedEmailBody(input.project, input.report);
    const deliveries = await Promise.all(
      input.recipients.map((recipient) =>
        sendNotification({
          projectId: input.project.id,
          recipient,
          eventType: "project_report_generated",
          subject,
          body,
        }),
      ),
    );

    return deliveries.filter((delivery): delivery is NotificationDelivery => Boolean(delivery));
  }

  async function sendLoginInfoEmail(input: {
    email: string;
    displayName?: string | null;
    loggedInAt: string;
  }): Promise<NotificationDelivery | null> {
    return sendNotification({
      userId: input.email,
      recipient: {
        email: input.email,
        userId: input.email,
      },
      eventType: "login_info",
      subject: "VERSOR PM Agent login successful",
      body: buildLoginInfoEmailBody(input),
    });
  }

  return {
    sendNotification,
    sendProjectReportGeneratedEmail,
    sendLoginInfoEmail,
  };
}
