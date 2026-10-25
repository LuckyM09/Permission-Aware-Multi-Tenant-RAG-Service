from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for compliance audit log records."""

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "tenant_id",
            "user_id",
            "user_email",
            "action",
            "query_text_sanitized",
            "retrieved_chunk_ids",
            "denied_chunk_count",
            "ip_address",
            "latency_ms",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields
