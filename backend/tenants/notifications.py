"""Email notifications for the registration-approval workflow."""

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _from_email() -> str:
    return getattr(settings, "DEFAULT_FROM_EMAIL", "leads@vaultrag.com")


def notify_owner_new_request(reg) -> None:
    """Tell the platform owner (ADMINS) that a registration request is waiting."""
    recipients = [email for _, email in getattr(settings, "ADMINS", [])]
    if not recipients:
        return
    try:
        send_mail(
            subject=f"[VaultRAG] Registration request: {reg.company_name}",
            message=(
                "A new registration request is waiting for your decision.\n\n"
                f"Company: {reg.company_name}\n"
                f"Admin: {reg.admin_name or '-'} <{reg.admin_email}>\n"
                f"IP: {reg.source_ip or '-'}\n\n"
                "Review it in Django admin: Tenants -> Registration requests, "
                "then run the Approve or Reject action."
            ),
            from_email=_from_email(),
            recipient_list=recipients,
            fail_silently=True,
        )
    except Exception:  # never let email problems break registration
        logger.warning("Owner notification failed", exc_info=True)


def notify_applicant_decision(reg) -> None:
    """Tell the applicant whether their request was approved or rejected."""
    base = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
    try:
        if reg.status == reg.Status.APPROVED:
            subject = "Your VaultRAG workspace is approved"
            message = (
                f"Hi,\n\nYour request for '{reg.company_name}' was approved. "
                f"You can sign in now with {reg.admin_email}:\n{base}/login\n"
            )
        else:
            subject = "Your VaultRAG registration request"
            message = (
                f"Hi,\n\nWe could not approve your request for '{reg.company_name}' "
                "at this time."
            )
            if reg.decision_note:
                message += f"\n\nNote: {reg.decision_note}"
        send_mail(
            subject=subject,
            message=message,
            from_email=_from_email(),
            recipient_list=[reg.admin_email],
            fail_silently=True,
        )
    except Exception:
        logger.warning("Applicant notification failed", exc_info=True)
