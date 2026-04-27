import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.ZOHO_FROM_NAME} <{settings.ZOHO_SMTP_USER}>"
    msg["To"] = to

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.ZOHO_SMTP_HOST,
            port=settings.ZOHO_SMTP_PORT,
            username=settings.ZOHO_SMTP_USER,
            password=settings.ZOHO_SMTP_PASSWORD,
            start_tls=True,
        )
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


# --- Email template helpers ---

def _base_template(title: str, body: str) -> str:
    return f"""
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
             background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }}
      .container {{ max-width: 600px; margin: 40px auto; background: #1e293b;
                   border-radius: 12px; padding: 40px; }}
      .logo {{ font-size: 20px; font-weight: 700; color: #3b82f6; margin-bottom: 32px; }}
      h1 {{ font-size: 24px; font-weight: 700; color: #f1f5f9; margin: 0 0 16px; }}
      p {{ line-height: 1.6; color: #94a3b8; margin: 0 0 16px; }}
      .btn {{ display: inline-block; padding: 14px 28px; background: #3b82f6;
              color: #fff; text-decoration: none; border-radius: 8px;
              font-weight: 600; margin: 24px 0; }}
      .footer {{ margin-top: 40px; padding-top: 24px; border-top: 1px solid #334155;
                 font-size: 12px; color: #475569; }}
    </style></head><body>
    <div class="container">
      <div class="logo">Financial Command Center</div>
      <h1>{title}</h1>
      {body}
      <div class="footer">
        <p>This email was sent by Financial Command Center. Do not reply to this email.</p>
      </div>
    </div></body></html>
    """


def verification_email(full_name: str, verify_url: str) -> tuple[str, str]:
    subject = "Verify your Financial Command Center account"
    html = _base_template(
        "Verify your email address",
        f"""
        <p>Hi {full_name},</p>
        <p>Welcome to Financial Command Center. Click the button below to verify your email
        address and start your journey to financial freedom.</p>
        <a href="{verify_url}" class="btn">Verify Email Address</a>
        <p>This link expires in 1 hour. If you did not create an account, ignore this email.</p>
        """,
    )
    return subject, html


def password_reset_email(full_name: str, reset_url: str) -> tuple[str, str]:
    subject = "Reset your Financial Command Center password"
    html = _base_template(
        "Reset your password",
        f"""
        <p>Hi {full_name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password.</p>
        <a href="{reset_url}" class="btn">Reset Password</a>
        <p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>
        """,
    )
    return subject, html


def security_alert_email(full_name: str, device_info: str) -> tuple[str, str]:
    subject = "New device login — Financial Command Center"
    html = _base_template(
        "New login detected",
        f"""
        <p>Hi {full_name},</p>
        <p>A new login to your account was detected from: <strong>{device_info}</strong></p>
        <p>If this was you, no action is needed. If this was not you, please reset your
        password immediately.</p>
        """,
    )
    return subject, html


def debt_cleared_email(full_name: str, debt_name: str, freedom_date: str) -> tuple[str, str]:
    subject = f"You cleared {debt_name}! Freedom Date updated."
    html = _base_template(
        f"You cleared {debt_name}!",
        f"""
        <p>Hi {full_name},</p>
        <p>Outstanding work! You have completely cleared <strong>{debt_name}</strong>.</p>
        <p>Your new Freedom Date is: <strong>{freedom_date}</strong></p>
        <p>Every payment you make brings that date closer. Keep going.</p>
        """,
    )
    return subject, html


def payment_warning_email(
    members: list[str],
    debt_name: str,
    amount: str,
    due_date: str,
    days_before: int,
) -> tuple[str, str]:
    subject = f"Payment due in {days_before} days — {debt_name}"
    names = " & ".join(members)
    html = _base_template(
        f"Payment coming up — {days_before} days",
        f"""
        <p>Hi {names},</p>
        <p>Your payment for <strong>{debt_name}</strong> is due in {days_before} days.</p>
        <p>Amount: <strong>{amount}</strong><br>Due date: <strong>{due_date}</strong></p>
        <p>Open the app to confirm your plan.</p>
        """,
    )
    return subject, html


def debt_payment_reminder_email(
    full_name: str,
    debt_name: str,
    amount: str,
    due_date: str,
    days_label: str,
    balance_remaining: str,
    currency: str,
) -> tuple[str, str]:
    subject = f"Payment reminder — {debt_name} due {days_label}"
    urgency_color = "#ef4444" if "today" in days_label.lower() or "overdue" in days_label.lower() else "#f59e0b" if "tomorrow" in days_label.lower() or "3 day" in days_label.lower() else "#3b82f6"
    html = _base_template(
        f"Payment coming up — {debt_name}",
        f"""
        <p>Hi {full_name},</p>
        <p>This is a reminder that your <strong>{debt_name}</strong> payment is due <strong>{days_label}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#0f172a;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:12px 16px;color:#94a3b8;font-size:13px;">Payment amount</td>
            <td style="padding:12px 16px;color:#f1f5f9;font-size:15px;font-weight:700;text-align:right;">{amount}</td>
          </tr>
          <tr style="border-top:1px solid #1e293b;">
            <td style="padding:12px 16px;color:#94a3b8;font-size:13px;">Due date</td>
            <td style="padding:12px 16px;color:{urgency_color};font-size:15px;font-weight:700;text-align:right;">{due_date}</td>
          </tr>
          <tr style="border-top:1px solid #1e293b;">
            <td style="padding:12px 16px;color:#94a3b8;font-size:13px;">Balance remaining</td>
            <td style="padding:12px 16px;color:#94a3b8;font-size:14px;text-align:right;">{balance_remaining} ({currency})</td>
          </tr>
        </table>
        <p>Making this payment on time keeps your Freedom Date on track. Every payment counts.</p>
        """,
    )
    return subject, html


def joint_formed_email(recipient_name: str, partner_email: str, account_id: str, app_url: str) -> tuple[str, str]:
    subject = "Your joint account is now active — Financial Command Center"
    html = _base_template(
        "Your joint account is active",
        f"""
        <p>Hi {recipient_name},</p>
        <p>Your joint account with <strong>{partner_email}</strong> is now active and both members are confirmed.</p>
        <p style="background:#0f172a;border-radius:8px;padding:16px;font-family:monospace;color:#94a3b8;">
          Account ID: <strong style="color:#f1f5f9;">{account_id}</strong>
        </p>
        <p>Keep this email. If anything ever goes wrong with your account, this ID is all that is needed to restore it instantly.</p>
        <a href="{app_url}/war-room" class="btn">Go to War Room</a>
        """,
    )
    return subject, html


def joint_invite_email(invited_email: str, inviter_name: str, invite_url: str) -> tuple[str, str]:
    subject = f"{inviter_name} invited you to Financial Command Center"
    html = _base_template(
        "You have been invited",
        f"""
        <p>{inviter_name} has invited you to join their Financial Command Center account.</p>
        <p>Together you will track your journey to financial freedom.</p>
        <a href="{invite_url}" class="btn">Accept Invitation</a>
        <p>This invitation expires in 7 days.</p>
        """,
    )
    return subject, html


def investment_secure_code_email(full_name: str, investment_name: str, code: str) -> tuple[str, str]:
    subject = "Your investment details verification code"
    html = _base_template(
        "Verify secure investment access",
        f"""
        <p>Hi {full_name},</p>
        <p>Your verification code for <strong>{investment_name}</strong> is:</p>
        <p style="font-size:28px;letter-spacing:6px;color:#f1f5f9;font-weight:700;margin:24px 0;">{code}</p>
        <p>This code expires in 10 minutes and can be used once.</p>
        <p>If you did not request this, ignore this email and review your account activity.</p>
        """,
    )
    return subject, html
