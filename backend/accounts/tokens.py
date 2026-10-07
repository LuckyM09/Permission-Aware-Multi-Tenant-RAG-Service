from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class VaultRAGTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT Serializer that encodes tenant-scoped claims:
    - user_id
    - email
    - tenant_id & tenant_name
    - role
    - groups
    """

    tenant_id = serializers.UUIDField(required=False, write_only=True)
    tenant_slug = serializers.CharField(required=False, write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Standard claims
        token["user_id"] = str(user.id)
        token["email"] = user.email

        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        requested_tenant_id = self.initial_data.get("tenant_id")
        requested_tenant_slug = self.initial_data.get("tenant_slug")

        memberships = (
            user.tenant_memberships.select_related("tenant")
            .filter(tenant__is_active=True)
            .order_by("-is_default", "-created_at")
        )

        if not memberships.exists():
            raise AuthenticationFailed("User is not a member of any active organization.")

        # Select target tenant membership
        target_membership = None
        if requested_tenant_id:
            target_membership = memberships.filter(tenant_id=requested_tenant_id).first()
            if not target_membership:
                raise AuthenticationFailed("User is not a member of the requested tenant.")
        elif requested_tenant_slug:
            target_membership = memberships.filter(tenant__slug=requested_tenant_slug).first()
            if not target_membership:
                raise AuthenticationFailed("User is not a member of the requested tenant organization.")
        else:
            target_membership = memberships.first()

        tenant = target_membership.tenant

        # Collect user's groups in this tenant
        user_groups = list(
            user.group_memberships.filter(group__tenant=tenant)
            .select_related("group")
            .values("group__id", "group__name")
        )
        group_ids = [str(g["group__id"]) for g in user_groups]
        group_names = [g["group__name"] for g in user_groups]

        # Inject claims into the refresh and access tokens
        refresh = self.get_token(user)
        refresh["tenant_id"] = str(tenant.id)
        refresh["tenant_name"] = tenant.name
        refresh["role"] = target_membership.role
        refresh["groups"] = group_ids

        # Access token inherits claims from refresh token
        access = refresh.access_token
        access["tenant_id"] = str(tenant.id)
        access["tenant_name"] = tenant.name
        access["role"] = target_membership.role
        access["groups"] = group_ids

        data["refresh"] = str(refresh)
        data["access"] = str(access)

        # Context details returned in response payload
        data["user"] = {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
        }
        data["tenant"] = {
            "id": str(tenant.id),
            "name": tenant.name,
            "slug": tenant.slug,
            "role": target_membership.role,
        }
        data["groups"] = group_names

        return data


class VaultRAGTokenObtainPairView(TokenObtainPairView):
    """View that issues tenant-scoped SimpleJWT tokens."""

    serializer_class = VaultRAGTokenObtainPairSerializer
