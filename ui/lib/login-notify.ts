import nodemailer from "nodemailer";

const DEFAULT_RECIPIENT = "ariel@apgardai.com";

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export async function sendLoginNotificationEmail(args: {
  email: string;
  name?: string | null;
  uid?: string | null;
}): Promise<void> {
  const enabled = boolFromEnv(process.env.LOGIN_NOTIFY_ENABLED, true);
  if (!enabled) return;

  const senderEmail = process.env.GMAIL_EMAIL?.trim();
  const appPassword = process.env.GMAIL_PASSWORD?.trim();
  if (!senderEmail || !appPassword) return;

  const recipient = process.env.LOGIN_NOTIFY_RECIPIENT?.trim() || DEFAULT_RECIPIENT;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "unknown";
  const loginAt = new Date().toISOString();

  const subject = `Child Safety UI login: ${args.email}`;
  const body = [
    "A user logged in to child-safety-evals/ui.",
    "",
    `Email: ${args.email}`,
    `Name: ${args.name?.trim() || "(none)"}`,
    `UID: ${args.uid?.trim() || "(none)"}`,
    `Time: ${loginAt}`,
    `App URL: ${appUrl}`,
  ].join("\n");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: senderEmail,
      pass: appPassword,
    },
  });

  await transporter.sendMail({
    from: senderEmail,
    to: recipient,
    subject,
    text: body,
  });
}
