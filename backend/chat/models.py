import uuid

from django.conf import settings
from django.db import models

from tenants.models import Tenant


class Conversation(models.Model):
    """
    A persistent conversation thread scoped strictly to a single (tenant, user) pair.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="conversations",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations",
        db_index=True,
    )
    title = models.CharField(
        max_length=255,
        default="New Conversation",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["tenant", "user"]),
            models.Index(fields=["tenant", "-updated_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.user.email})"


class Message(models.Model):
    """
    An individual dialogue turn within a Conversation, carrying
    role, generated content, and verified document citations.
    """

    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
    )
    content = models.TextField()
    citations = models.JSONField(
        default=list,
        blank=True,
        help_text="List of verified citation chunk payloads and figure references",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Message"
        verbose_name_plural = "Messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.role.capitalize()} on {self.conversation.id}: {self.content[:40]}..."
