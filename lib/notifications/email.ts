import nodemailer from "nodemailer";

import { sendEmailNotificationInputSchema, type SendEmailNotificationInput } from "../../types/models";

export class EmailConfigurationError extends Error {
  constructor(message = "Email notification provider is not configured.") {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

type EmailEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, "EMAIL_FROM" | "EMAIL_PROVIDER" | "GMAIL_SMTP_APP_PASSWORD" | "GMAIL_SMTP_USER">
>;

type MailTransporter = {
  sendMail(input: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<{ messageId?: string }>;
};

type EmailSenderOptions = {
  env?: EmailEnvironment;
  createTransport?: typeof nodemailer.createTransport;
};

function getRequiredEnv(env: EmailEnvironment, key: keyof EmailEnvironment): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new EmailConfigurationError("Email notification provider is not configured.");
  }
  return value;
}

export function createEmailNotificationSender(options: EmailSenderOptions = {}) {
  const env: EmailEnvironment = options.env || {
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    GMAIL_SMTP_APP_PASSWORD: process.env.GMAIL_SMTP_APP_PASSWORD,
    GMAIL_SMTP_USER: process.env.GMAIL_SMTP_USER,
  };
  const createTransport = options.createTransport || nodemailer.createTransport;

  return async function sendEmailNotification(input: SendEmailNotificationInput): Promise<string | null> {
    const parsed = sendEmailNotificationInputSchema.parse(input);
    const provider = getRequiredEnv(env, "EMAIL_PROVIDER");
    if (provider !== "gmail") {
      throw new EmailConfigurationError("Email notification provider is not configured.");
    }

    const from = getRequiredEnv(env, "EMAIL_FROM");
    const user = getRequiredEnv(env, "GMAIL_SMTP_USER");
    const pass = getRequiredEnv(env, "GMAIL_SMTP_APP_PASSWORD");

    const transporter = createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
    }) as MailTransporter;

    const result = await transporter.sendMail({
      from,
      to: parsed.to,
      subject: parsed.subject,
      text: parsed.text,
    });

    return result.messageId || null;
  };
}

export const sendEmailNotification = createEmailNotificationSender();
