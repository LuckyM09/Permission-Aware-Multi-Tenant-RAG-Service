import re
from uuid import UUID

from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            "id",
            "role",
            "content",
            "citations",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id",
            "title",
            "created_at",
            "updated_at",
            "messages",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ConversationListSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source="messages.count", read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id",
            "title",
            "created_at",
            "updated_at",
            "message_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "message_count"]


class ChatQuerySerializer(serializers.Serializer):
    query = serializers.CharField(
        max_length=2000,
        required=True,
        trim_whitespace=True,
        help_text="User question for RAG generation",
    )
    conversation_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Optional conversation thread ID to continue dialogue",
    )
    top_k = serializers.IntegerField(
        default=5,
        min_value=1,
        max_value=20,
    )
    threshold = serializers.FloatField(
        default=0.25,
        min_value=0.0,
        max_value=1.0,
    )
    mode = serializers.ChoiceField(
        choices=["hybrid", "dense", "sparse"],
        default="hybrid",
    )
    rerank = serializers.BooleanField(
        default=True,
    )
    stream = serializers.BooleanField(
        default=False,
        help_text="If True, streams response as text/event-stream (SSE)",
    )
    filters = serializers.DictField(
        required=False,
        default=dict,
        help_text="Metadata pre-filters (document_id, file_type, date, etc.)",
    )

    def validate_filters(self, value: dict) -> dict:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Filters must be a JSON object.")
        for key in ["document_id", "doc_id"]:
            if key in value and value[key]:
                val = value[key]
                if isinstance(val, (list, tuple)):
                    for item in val:
                        try:
                            UUID(str(item))
                        except (ValueError, TypeError):
                            raise serializers.ValidationError(f"Invalid UUID in '{key}': {item}")
                else:
                    try:
                        UUID(str(val))
                    except (ValueError, TypeError):
                        raise serializers.ValidationError(f"Invalid UUID in '{key}': {val}")
        if "document_ids" in value and value["document_ids"]:
            for item in value["document_ids"]:
                try:
                    UUID(str(item))
                except (ValueError, TypeError):
                    raise serializers.ValidationError(f"Invalid UUID in 'document_ids': {item}")
        meta = value.get("metadata")
        if meta and isinstance(meta, dict):
            for k in meta.keys():
                if not isinstance(k, str) or "__" in k or not re.match(r"^[a-zA-Z0-9_-]+$", k):
                    raise serializers.ValidationError(f"Invalid metadata key: '{k}'. Must be an identifier without '__'.")
        return value
    expand_parent = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Whether to expand child chunk to parent window context",
    )
    query_expansion = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether to perform multi-query expansion",
    )
