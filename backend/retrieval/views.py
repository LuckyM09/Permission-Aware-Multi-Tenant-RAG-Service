from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.context import get_user_context

from .serializers import SearchRequestSerializer, SearchResponseSerializer
from .services import RetrievalService


class SearchView(APIView):
    """
    POST /api/v1/retrieval/search/
    Executes a permission-filtered hybrid vector and keyword search across documents.
    Applies Reciprocal Rank Fusion (RRF), Cross-Encoder Reranking, metadata filtering,
    parent-child context expansion, and query expansion while strictly enforcing
    zero data leakage across all retrieval paths.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "search"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.retrieval_service = RetrievalService()

    def post(self, request):
        serializer = SearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_ctx = get_user_context(request)
        query = serializer.validated_data["query"]
        top_k = serializer.validated_data.get("top_k", 5)
        threshold = serializer.validated_data.get("threshold", 0.0)
        mode = serializer.validated_data.get("mode", "hybrid")
        rerank = serializer.validated_data.get("rerank", True)
        alpha = serializer.validated_data.get("alpha", 0.5)
        filters = serializer.validated_data.get("filters", {})
        expand_parent = serializer.validated_data.get("expand_parent", False)
        query_expansion = serializer.validated_data.get("query_expansion", False)

        results = self.retrieval_service.search(
            user_ctx=user_ctx,
            query=query,
            top_k=top_k,
            threshold=threshold,
            mode=mode,
            rerank=rerank,
            alpha=alpha,
            filters=filters,
            expand_parent=expand_parent,
            query_expansion=query_expansion,
        )

        response_data = {
            "query": query,
            "mode": mode,
            "reranked": rerank,
            "results": results,
            "total_found": len(results),
        }
        response_serializer = SearchResponseSerializer(response_data)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
