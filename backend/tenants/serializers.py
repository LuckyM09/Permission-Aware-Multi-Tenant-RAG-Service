from rest_framework import serializers

from tenants.models import Group, GroupMember, Membership, Role


class TenantMemberSerializer(serializers.ModelSerializer):
    """
    Serializes a tenant member with profile information and assigned groups.
    """

    user_id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    groups = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = [
            "id",
            "user_id",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_default",
            "created_at",
            "groups",
        ]
        read_only_fields = ["id", "user_id", "email", "first_name", "last_name", "created_at"]

    def get_groups(self, obj: Membership) -> list[dict]:
        group_members = (
            GroupMember.objects.filter(
                group__tenant=obj.tenant,
                user=obj.user,
            )
            .select_related("group")
            .order_by("group__name")
        )
        return [{"id": str(gm.group.id), "name": gm.group.name} for gm in group_members]


class TenantMemberRoleUpdateSerializer(serializers.Serializer):
    """
    Validates role updates for a tenant membership.
    """

    role = serializers.ChoiceField(choices=Role.choices)


class GroupMemberItemSerializer(serializers.ModelSerializer):
    """
    Serializes a single user inside a group.
    """

    user_id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = GroupMember
        fields = ["id", "user_id", "email", "first_name", "last_name", "created_at"]
        read_only_fields = ["id", "user_id", "email", "first_name", "last_name", "created_at"]


class GroupSerializer(serializers.ModelSerializer):
    """
    Serializes an access control group and its assigned member summary.
    """

    member_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "member_count",
            "members",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "member_count", "members"]

    def get_member_count(self, obj: Group) -> int:
        return obj.memberships.count()

    def get_members(self, obj: Group) -> list[dict]:
        # Include detailed member items if specifically requested
        memberships = obj.memberships.select_related("user").order_by("user__email")[:50]
        return GroupMemberItemSerializer(memberships, many=True).data

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Group name cannot be empty.")
        return name


class GroupMemberActionSerializer(serializers.Serializer):
    """
    Validates adding/removing a user to/from a group.
    """

    user_id = serializers.UUIDField()


class AccessExplorerRequestSerializer(serializers.Serializer):
    """
    Validates target user selection for the Access Explorer simulation.
    """

    user_id = serializers.UUIDField()


class AccessExplorerDocumentSerializer(serializers.Serializer):
    """
    Represents an evaluated document in the Access Explorer audit view.
    """

    document_id = serializers.UUIDField()
    title = serializers.CharField()
    visibility = serializers.CharField()
    owner_email = serializers.CharField()
    status = serializers.CharField()
    access_status = serializers.ChoiceField(choices=["ALLOWED", "DENIED"])
    matched_rules = serializers.ListField(child=serializers.CharField())
    chunk_count = serializers.IntegerField()


class AccessExplorerResponseSerializer(serializers.Serializer):
    """
    Complete audit payload returned by the Access Explorer.
    """

    target_user = serializers.DictField()
    total_documents = serializers.IntegerField()
    accessible_documents = serializers.IntegerField()
    denied_documents = serializers.IntegerField()
    documents = AccessExplorerDocumentSerializer(many=True)
