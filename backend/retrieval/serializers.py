from rest_framework import serializers


class SearchRequestSerializer(serializers.Serializer):
    """Validates vector and hybrid retrieval search query arguments."""

    query = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=1000,
        trim_whitespace=True,
        help_text="Natural language query string",
    )
    top_k = serializers.IntegerField(
        required=False,
        default=5,
        min_value=1,
        max_value=20,
        help_text="Maximum number of chunks to return (1-20)",
    )
    threshold = serializers.FloatField(
        required=False,
        default=0.0,
        min_value=0.0,
        max_value=1.0,
        help_text="Minimum score cutoff (0.0 to 1.0)",
    )
    mode = serializers.ChoiceField(
        choices=["hybrid", "dense", "sparse"],
        required=False,
        default="hybrid",
        help_text="Search modality: 'hybrid' (RRF), 'dense' (Vector), or 'sparse' (BM25)",
    )
    rerank = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Whether to apply cross-encoder reranking",
    )
    alpha = serializers.FloatField(
        required=False,
        default=0.5,
        min_value=0.0,
        max_value=1.0,
        help_text="Dense vs sparse weight balance in hybrid mode (0.0 to 1.0)",
    )
    filters = serializers.DictField(
        required=False,
        default=dict,
        help_text="Metadata pre-filters (e.g. document_id, file_type, date_from, custom metadata)",
    )
    expand_parent = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether to expand child chunk with parent context window",
    )
    query_expansion = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether to execute multi-query expansion via RRF",
    )


class SearchResultItemSerializer(serializers.Serializer):
    """Represents a retrieved chunk with similarity score, provenance, and metadata."""

    chunk_id = serializers.UUIDField()
    document_id = serializers.UUIDField()
    document_title = serializers.CharField()
    visibility = serializers.CharField()
    position = serializers.IntegerField(required=False)
    text = serializers.CharField()
    parent_text = serializers.CharField(required=False, allow_blank=True)
    distance = serializers.FloatField()
    similarity = serializers.FloatField()
    score = serializers.FloatField(required=False)
    retrieval_mode = serializers.CharField(required=False, default="hybrid")
    reranked = serializers.BooleanField(required=False, default=False)
    metadata = serializers.DictField(required=False, default=dict)


class SearchResponseSerializer(serializers.Serializer):
    """Standardized search response payload."""

    query = serializers.CharField()
    mode = serializers.CharField(required=False, default="hybrid")
    reranked = serializers.BooleanField(required=False, default=True)
    results = SearchResultItemSerializer(many=True)
    total_found = serializers.IntegerField()
