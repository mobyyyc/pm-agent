import assert from "node:assert/strict";
import test from "node:test";

import { createEmailNotificationSender, EmailConfigurationError } from "../lib/notifications/email";
import { buildLoginInfoEmailBody, buildProjectReportGeneratedEmailBody, createNotificationService } from "../lib/notifications/service";
import { sendEmailNotificationInputSchema, type NotificationDelivery, type Project, type ProjectReportArtifact } from "../types/models";

const project: Project = {
  id: "project_1",
  userId: "owner@example.com",
  name: "Launch",
  idea: "Launch a product",
  guideline: "Keep the team focused.",
  timeline: [],
  taskIds: [],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const report: ProjectReportArtifact = {
  id: "report_1",
  projectId: project.id,
  createdByUserId: null,
  period: "weekly",
  periodStart: "2026-05-03",
  periodEnd: "2026-05-09",
  generatedAt: "2026-05-09T12:00:00.000Z",
  source: "scheduled",
  createdAt: "2026-05-09T12:00:00.000Z",
  report: {
    projectId: project.id,
    projectName: project.name,
    period: "weekly",
    generatedAt: "2026-05-09T12:00:00.000Z",
    executiveSummary: "The project is moving.",
    progressOverview: "1 of 4 tasks are complete.",
    completedWork: ["Ship beta"],
    inProgressWork: ["Build onboarding"],
    riskyWork: ["Fix billing is overdue."],
    activityHighlights: ["Task status changed."],
    healthExplanation: "One task is overdue.",
    suggestedNextActions: [
      {
        title: "Resolve the overdue task",
        rationale: "It is the clearest risk.",
        priority: "warning",
      },
    ],
  },
  inputSnapshot: {
    period: "weekly",
    generatedAt: "2026-05-09T12:00:00.000Z",
    periodStart: "2026-05-03",
    periodEnd: "2026-05-09",
    project: {
      id: project.id,
      name: project.name,
      idea: project.idea,
      guideline: project.guideline,
    },
    progress: {
      totalTasks: 4,
      completedTasks: 1,
      inProgressTasks: 1,
      todoTasks: 2,
      completionPercent: 25,
      overdueTasks: 1,
      dueSoonTasks: 1,
      unassignedTasks: 0,
      timelinePhaseCount: 0,
      completedTimelinePhases: 0,
      currentTimelinePhase: null,
      projectWindow: {
        startDate: null,
        endDate: null,
      },
    },
    health: {
      status: "watch",
      label: "Watch",
      message: "1 task is past deadline.",
      signals: [],
      evaluatedAt: "2026-05-09",
    },
    tasks: {
      all: [],
      completed: [],
      inProgress: [],
      overdue: [],
      dueSoon: [],
      unassigned: [],
    },
    recentActivity: [],
    comparisonSummary: {
      previousReportId: "report_previous",
      previousReportCreatedAt: "2026-05-08T12:00:00.000Z",
      taskChanges: {
        completedSinceLastReport: [],
        newlyOverdue: [],
        newlyCreated: [],
        statusChanged: [],
      },
      activityChanges: {
        newActivityCount: 1,
        newCommitCount: 0,
        newMemberAttributedActivity: 0,
      },
      progressDelta: {
        completionPercentDelta: 5,
        overdueTasksDelta: 1,
        dueSoonTasksDelta: 0,
      },
      healthChange: {
        previousStatus: "healthy",
        currentStatus: "watch",
        changed: true,
      },
      notableChanges: ["Progress increased by 5%."],
    },
  },
};

function makeDelivery(overrides: Partial<NotificationDelivery> = {}): NotificationDelivery {
  return {
    id: "delivery_1",
    projectId: project.id,
    userId: "owner@example.com",
    recipientEmail: "owner@example.com",
    channel: "email",
    eventType: "project_report_generated",
    subject: "New VERSOR report: Launch",
    bodyPreview: "Preview",
    status: "pending",
    providerMessageId: null,
    errorMessage: null,
    createdAt: "2026-05-09T12:00:00.000Z",
    sentAt: null,
    ...overrides,
  };
}

test("missing Gmail env throws safe config error", async () => {
  const sendEmail = createEmailNotificationSender({ env: {} });

  await assert.rejects(
    () => sendEmail({ to: "owner@example.com", subject: "Hello", text: "Body" }),
    (error) => error instanceof EmailConfigurationError && error.message === "Email notification provider is not configured.",
  );
});

test("email input validation rejects invalid email recipients", async () => {
  assert.throws(
    () => sendEmailNotificationInputSchema.parse({ to: "not-email", subject: "Hello", text: "Body" }),
    /Invalid email/,
  );
});

test("email sender uses nodemailer transport without sending real email", async () => {
  const sent: unknown[] = [];
  const sendEmail = createEmailNotificationSender({
    env: {
      EMAIL_PROVIDER: "gmail",
      EMAIL_FROM: "VERSOR PM Agent <sender@example.com>",
      GMAIL_SMTP_USER: "sender@example.com",
      GMAIL_SMTP_APP_PASSWORD: "app-password",
    },
    createTransport: ((config: unknown) => {
      sent.push(config);
      return {
        async sendMail(message: unknown) {
          sent.push(message);
          return { messageId: "smtp_1" };
        },
      };
    }) as never,
  });

  const messageId = await sendEmail({ to: "owner@example.com", subject: "Hello", text: "Body" });

  assert.equal(messageId, "smtp_1");
  assert.deepEqual(sent[0], {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "sender@example.com",
      pass: "app-password",
    },
  });
});

test("notification delivery is marked failed if provider throws", async () => {
  const service = createNotificationService({
    async createDelivery() {
      return makeDelivery();
    },
    async markSent() {
      throw new Error("should not mark sent");
    },
    async markFailed(id, errorMessage) {
      return makeDelivery({ id, status: "failed", errorMessage });
    },
    async sendEmail() {
      throw new Error("SMTP refused credentials with secret app-password");
    },
    now: () => "2026-05-09T12:00:00.000Z",
  });

  const delivery = await service.sendNotification({
    projectId: project.id,
    recipient: { email: "owner@example.com", userId: "owner@example.com" },
    eventType: "project_report_generated",
    subject: "New VERSOR report: Launch",
    body: "Body",
  });

  assert.equal(delivery?.status, "failed");
  assert.equal(delivery?.errorMessage, "Email notification failed.");
});

test("scheduled report generation continues even if email sending fails", async () => {
  const service = createNotificationService({
    async createDelivery() {
      return makeDelivery();
    },
    async markSent() {
      throw new Error("should not mark sent");
    },
    async markFailed(id, errorMessage) {
      return makeDelivery({ id, status: "failed", errorMessage });
    },
    async sendEmail() {
      throw new Error("SMTP unavailable");
    },
    now: () => "2026-05-09T12:00:00.000Z",
  });

  await assert.doesNotReject(() =>
    service.sendProjectReportGeneratedEmail({
      project,
      report,
      recipients: [{ email: "owner@example.com", userId: "owner@example.com" }],
    }),
  );
});

test("report email body includes project name", () => {
  const body = buildProjectReportGeneratedEmailBody(project, report);

  assert.match(body, /Launch/);
});

test("report email body includes progress and health fields when available", () => {
  const body = buildProjectReportGeneratedEmailBody(project, report);

  assert.match(body, /Health: Watch \(watch\)/);
  assert.match(body, /Progress: 25% complete/);
  assert.match(body, /Progress increased by 5%/);
});

test("login info notification sends to the signed-in user", async () => {
  const sentMessages: unknown[] = [];
  const service = createNotificationService({
    async createDelivery(input) {
      return makeDelivery({
        projectId: null,
        userId: input.userId,
        recipientEmail: input.recipientEmail,
        eventType: input.eventType,
        subject: input.subject,
        bodyPreview: input.bodyPreview,
      });
    },
    async markSent(id, providerMessageId) {
      return makeDelivery({
        id,
        projectId: null,
        status: "sent",
        providerMessageId,
        sentAt: "2026-05-09T12:00:01.000Z",
        eventType: "login_info",
      });
    },
    async markFailed() {
      throw new Error("should not mark failed");
    },
    async sendEmail(input) {
      sentMessages.push(input);
      return "login_smtp_1";
    },
    now: () => "2026-05-09T12:00:00.000Z",
  });

  const delivery = await service.sendLoginInfoEmail({
    email: "owner@example.com",
    displayName: "Owner",
    loggedInAt: "2026-05-09T12:00:00.000Z",
  });

  assert.equal(delivery?.status, "sent");
  assert.equal(delivery?.eventType, "login_info");
  assert.deepEqual(sentMessages[0], {
    to: "owner@example.com",
    subject: "VERSOR PM Agent login successful",
    text: buildLoginInfoEmailBody({
      email: "owner@example.com",
      displayName: "Owner",
      loggedInAt: "2026-05-09T12:00:00.000Z",
    }),
  });
});

test("login info email body includes successful login text and account email", () => {
  const body = buildLoginInfoEmailBody({
    email: "owner@example.com",
    displayName: null,
    loggedInAt: "2026-05-09T12:00:00.000Z",
  });

  assert.match(body, /successfully logged in/);
  assert.match(body, /owner@example.com/);
});
