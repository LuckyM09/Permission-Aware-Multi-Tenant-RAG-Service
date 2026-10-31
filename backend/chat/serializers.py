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
