import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? "localhost",
  port:   parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const FROM    = process.env.SMTP_FROM
  ?? (process.env.SMTP_USER ? `HobbyPanel <${process.env.SMTP_USER}>` : "HobbyPanel <noreply@hobbypanel.app>");
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// ── Shared layout ─────────────────────────────────────────────────────────────

function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px">

        <!-- Wordmark -->
        <tr><td style="padding-bottom:28px">
          <span style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">HobbyPanel</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#111113;border:1px solid #27272a;border-radius:10px;padding:28px 28px 24px">
          <h1 style="margin:0 0 12px;font-size:17px;font-weight:600;color:#ffffff;line-height:1.3">${title}</h1>
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:20px;text-align:center">
          <p style="margin:0;font-size:11px;color:#3f3f46">
            HobbyPanel &middot; <a href="${APP_URL}" style="color:#3f3f46;text-decoration:underline">hobbypanel</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function actionButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#22c55e;color:#000000;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none">${label}</a>`;
}

function muted(text: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;color:#52525b;line-height:1.5">${text}</p>`;
}

// ── Email verification ────────────────────────────────────────────────────────

export async function sendEmailVerification(email: string, token: string): Promise<void> {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject: "Verify your HobbyPanel email",
    text:    `Verify your email address:\n\n${link}\n\nThis link expires in 24 hours.`,
    html:    emailLayout("Verify your email", `
      <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6">
        Click below to verify your email address and activate your account.
      </p>
      ${actionButton(link, "Verify Email Address")}
      ${muted("Link expires in 24 hours. If you didn't sign up for HobbyPanel, ignore this email.")}
    `),
  });
}

// ── Email 2FA code ────────────────────────────────────────────────────────────

export async function sendTwoFactorCode(email: string, code: string): Promise<void> {
  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject: `${code} is your HobbyPanel sign-in code`,
    text:    `Your HobbyPanel verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html:    emailLayout(`Your sign-in code: ${code}`, `
      <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6">
        Use the code below to complete your sign-in. It expires in 10 minutes.
      </p>
      <div style="background:#0d0d0f;border:1px solid #27272a;border-radius:6px;padding:20px;text-align:center;margin-bottom:4px">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;font-family:'Courier New',monospace">${code}</span>
      </div>
      ${muted("Do not share this code with anyone. HobbyPanel staff will never ask for it.")}
    `),
  });
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function sendPasswordReset(email: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject: "Reset your HobbyPanel password",
    text:    `Reset your password:\n\n${link}\n\nThis link expires in 1 hour.`,
    html:    emailLayout("Reset your password", `
      <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6">
        Someone requested a password reset for your HobbyPanel account. Click below to set a new password.
      </p>
      ${actionButton(link, "Reset Password")}
      ${muted("Link expires in 1 hour. If you didn't request this, ignore this email.")}
    `),
  });
}

// ── 2FA backup codes ──────────────────────────────────────────────────────────

export async function sendBackupCodes(email: string, codes: string[]): Promise<void> {
  const codeRows = codes
    .map((c) => `<tr><td style="padding:5px 0;font-size:14px;font-family:'Courier New',monospace;letter-spacing:1px;color:#22c55e;text-align:center">${c}</td></tr>`)
    .join("");

  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject: "Your HobbyPanel 2FA backup codes",
    text:    `Two-factor authentication is now enabled.\n\nBackup codes (each usable once):\n\n${codes.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
    html:    emailLayout("2FA backup codes", `
      <p style="margin:0 0 16px;font-size:14px;color:#a1a1aa;line-height:1.6">
        Two-factor authentication has been enabled. Save these backup codes — each can only be used once if you lose access to your authenticator app.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0f;border:1px solid #27272a;border-radius:6px;padding:16px;margin-bottom:4px">
        ${codeRows}
      </table>
      ${muted("If you didn't enable 2FA, contact support immediately.")}
    `),
  });
}

// ── Server deletion notice ────────────────────────────────────────────────────

export async function sendServerDeletionNotice(
  email:       string,
  serverName:  string,
  archivePath: string | null,
  archiveMb:   number | undefined
): Promise<void> {
  const hasAttachment = archivePath !== null;
  const tooLarge      = !hasAttachment && archiveMb !== undefined && archiveMb > 0;

  let backupNote: string;
  let noteColor: string;
  if (hasAttachment)  { backupNote = `A backup of your server files (${archiveMb} MB) is attached.`; noteColor = "#16a34a"; }
  else if (tooLarge)  { backupNote = `Your server was ${archiveMb} MB — too large to attach. Files have been permanently deleted.`; noteColor = "#b45309"; }
  else                { backupNote = "No server data files were found."; noteColor = "#52525b"; }

  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject: `Your server "${serverName}" was deleted`,
    text:    `Your Minecraft server "${serverName}" has been permanently deleted from HobbyPanel.\n\n${backupNote}`,
    html:    emailLayout("Server deleted", `
      <p style="margin:0 0 16px;font-size:14px;color:#a1a1aa;line-height:1.6">
        Your Minecraft server <strong style="color:#ffffff">${serverName}</strong> has been permanently deleted from HobbyPanel.
      </p>
      <p style="margin:0;font-size:13px;color:${noteColor}">${backupNote}</p>
      ${muted("If you didn't request this deletion, contact support immediately.")}
    `),
    ...(hasAttachment && archivePath
      ? {
          attachments: [{
            filename:    `${serverName.replace(/[^a-z0-9._-]/gi, "_")}-backup.tar.gz`,
            path:        archivePath,
            contentType: "application/gzip",
          }],
        }
      : {}),
  });
}
