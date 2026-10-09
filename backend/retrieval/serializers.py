from rest_framework import serializers


class SearchRequestSerializer(serializers.Serializer):
    """Validates vector retrieval search query arguments."""

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
        help_text="Minimum cosine similarity cutoff (0.0 to 1.0)",
    )


class SearchResultItemSerializer(serializers.Serializer):
    """Represents a retrieved chunk with similarity score and metadata."""

    chunk_id = serializers.UUIDField()
    document_id = serializers.UUIDField()
    document_title = serializers.CharField()
    visibility = serializers.CharField()
    text = serializers.CharField()
    distance = serializers.FloatField()
    similarity = serializers.FloatField()
    metadata = serializers.DictField()


class SearchResponseSerializer(serializers.Serializer):
    """Standardized search response payload."""

    query = serializers.CharField()
    results = SearchResultItemSerializer(many=True)
    total_found = serializers.IntegerField()
