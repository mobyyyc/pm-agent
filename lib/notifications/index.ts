import { sendEmailNotification } from "@/lib/notifications/email";
import {
  buildLoginInfoEmailBody,
  buildProjectReportGeneratedEmailBody,
  createNotificationService,
} from "@/lib/notifications/service";
import {
  createNotificationDelivery,
  markNotificationDeliveryFailed,
  markNotificationDeliverySent,
} from "@/lib/storage";

const notificationService = createNotificationService({
  createDelivery: createNotificationDelivery,
  markSent: markNotificationDeliverySent,
  markFailed: markNotificationDeliveryFailed,
  sendEmail: sendEmailNotification,
  now: () => new Date().toISOString(),
});

export { buildLoginInfoEmailBody, buildProjectReportGeneratedEmailBody, createNotificationService };
export const sendNotification = notificationService.sendNotification;
export const sendProjectReportGeneratedEmail = notificationService.sendProjectReportGeneratedEmail;
export const sendLoginInfoEmail = notificationService.sendLoginInfoEmail;
