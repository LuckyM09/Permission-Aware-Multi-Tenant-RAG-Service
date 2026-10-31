from django.http import StreamingHttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.context import get_user_context

from .models import Conversation
from .serializers import (
    ChatQuerySerializer,
    ConversationListSerializer,
    ConversationSerializer,
)
from .services import ChatService


class ConversationListCreateView(APIView):
    """
    List user conversation threads or create a new thread.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_ctx = get_user_context(request)
        conversations = (
            Conversation.objects.filter(
                tenant_id=user_ctx.tenant_id,
                user_id=user_ctx.user_id,
            )
            .prefetch_related("messages")
            .order_by("-updated_at")
        )
        serializer = ConversationListSerializer(conversations, many=True)
        return Response(serializer.data)

    def post(self, request):
        user_ctx = get_user_context(request)
        title = request.data.get("title", "New Conversation")
        conversation = Conversation.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            title=title[:250],
        )
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    """
    Retrieve or delete an individual conversation thread.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        user_ctx = get_user_context(request)
        try:
            conversation = Conversation.objects.prefetch_related("messages").get(
                id=pk,
                tenant_id=user_ctx.tenant_id,
                user_id=user_ctx.user_id,
            )
        except Conversation.DoesNotExist:
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ConversationSerializer(conversation)
        return Response(serializer.data)

    def delete(self, request, pk):
        user_ctx = get_user_context(request)
        try:
            conversation = Conversation.objects.get(
                id=pk,
                tenant_id=user_ctx.tenant_id,
                user_id=user_ctx.user_id,
            )
            conversation.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Conversation.DoesNotExist:
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )


class ChatMessageView(APIView):
    """
    Executes permission-filtered RAG chat generation.
    Supports both standard JSON delivery and SSE streaming (stream=True).
    Supports metadata filters, parent-child context expansion, and query expansion.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChatQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_ctx = get_user_context(request)
        if not user_ctx.tenant_id:
            return Response(
                {"detail": "No active tenant context found for user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = ChatService()
        stream_requested = data.get("stream", False)

        if stream_requested:
            event_stream = service.stream_chat_response(
                user_ctx=user_ctx,
                query=data["query"],
                conversation_id=str(data["conversation_id"])
                if data.get("conversation_id")
                else None,
                top_k=data.get("top_k", 5),
                threshold=data.get("threshold", 0.0),
                mode=data.get("mode", "hybrid"),
                rerank=data.get("rerank", True),
                filters=data.get("filters", {}),
                expand_parent=data.get("expand_parent", True),
                query_expansion=data.get("query_expansion", False),
            )
            response = StreamingHttpResponse(
                event_stream, content_type="text/event-stream"
            )
            response["Cache-Control"] = "no-cache"
            response["X-Accel-Buffering"] = "no"
            return response

        result = service.generate_chat_response(
            user_ctx=user_ctx,
            query=data["query"],
            conversation_id=str(data["conversation_id"])
            if data.get("conversation_id")
            else None,
            top_k=data.get("top_k", 5),
            threshold=data.get("threshold", 0.0),
            mode=data.get("mode", "hybrid"),
            rerank=data.get("rerank", True),
            filters=data.get("filters", {}),
            expand_parent=data.get("expand_parent", True),
            query_expansion=data.get("query_expansion", False),
        )
        return Response(result, status=status.HTTP_200_OK)
