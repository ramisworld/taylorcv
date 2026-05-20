import "server-only";

import { Resend } from "resend";

import { env } from "~/env";

let resend: Resend | null = null;
const fallbackFrom = "TaylorCV <hello@taylorcv.local>";

function getResend() {
  resend ??= new Resend(env.RESEND_API_KEY);
  return resend;
}

function emailShell(args: { title: string; body: string; cta: string; url: string }) {
  return `
    <div style="margin:0;background:#030813;padding:32px;font-family:Inter,Arial,sans-serif;color:#e5edff">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(59,130,246,.26);border-radius:18px;background:#071326;padding:32px;box-shadow:0 24px 80px rgba(0,0,0,.28)">
        <div style="font-size:14px;letter-spacing:.22em;text-transform:uppercase;color:#7dd3fc;font-weight:700">Taylor CV</div>
        <h1 style="margin:24px 0 12px;font-size:28px;line-height:1.15;color:#fff">${args.title}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#cbd5e1">${args.body}</p>
        <a href="${args.url}" style="display:inline-block;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:13px 18px">${args.cta}</a>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8">If the button does not work, paste this link into your browser:<br>${args.url}</p>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail(args: { email: string; url: string }) {
  await getResend().emails.send({
    from: env.AUTH_EMAIL_FROM ?? fallbackFrom,
    to: args.email,
    subject: "Verify your TaylorCV email",
    html: emailShell({
      title: "Verify your email",
      body: "Confirm your email address to generate and save your tailored CV with TaylorCV.",
      cta: "Verify email",
      url: args.url,
    }),
  });
}

export async function sendPasswordResetEmail(args: { email: string; url: string }) {
  await getResend().emails.send({
    from: env.AUTH_EMAIL_FROM ?? fallbackFrom,
    to: args.email,
    subject: "Reset your TaylorCV password",
    html: emailShell({
      title: "Reset your password",
      body: "Use this secure link to choose a new password for your TaylorCV account.",
      cta: "Reset password",
      url: args.url,
    }),
  });
}
