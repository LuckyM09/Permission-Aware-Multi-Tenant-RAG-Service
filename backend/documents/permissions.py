"""
Authoritative Single Source of Truth for Permissions (Golden Rule #4).
All retrieval queries, document listings, detail checks, and access validations
must invoke this logic.
"""


from django.db.models import Q

from accounts.context import UserContext
from documents.models import Document


def get_permitted_documents_q(user_ctx: UserContext) -> Q:
    """
    Returns a Django Q object scoping documents accessible to the given UserContext.
    Tenant boundary is strictly enforced.
    - Tenant Admins: all documents within their tenant.
    - Members / Viewers: tenant-wide OR owned by user OR in permitted groups.
    """
    tenant_q = Q(tenant_id=user_ctx.tenant_id)
    if user_ctx.is_admin():
        return tenant_q

    base_visibility_q = Q(visibility=Document.Visibility.TENANT) | Q(
        owner_id=user_ctx.user_id
    )
    if user_ctx.group_ids:
        base_visibility_q |= Q(
            visibility=Document.Visibility.GROUP,
            permissions__group_id__in=user_ctx.group_ids,
        )

    return tenant_q & base_visibility_q


def get_permitted_chunks_q(user_ctx: UserContext) -> Q:
    """
    Returns a Django Q object scoping chunks accessible to the given UserContext.
    Enforces tenant scoping and document status READY.
    """
    base_q = Q(
        tenant_id=user_ctx.tenant_id,
        document__status=Document.Status.READY,
    )
    if user_ctx.is_admin():
        return base_q

    doc_visibility_q = Q(document__visibility=Document.Visibility.TENANT) | Q(
        document__owner_id=user_ctx.user_id
    )
    if user_ctx.group_ids:
        doc_visibility_q |= Q(
            document__visibility=Document.Visibility.GROUP,
            document__permissions__group_id__in=user_ctx.group_ids,
        )

    return base_q & doc_visibility_q


def can_view_document(user_ctx: UserContext, document: Document) -> bool:
    """Evaluates whether user_ctx is permitted to read document metadata/content."""
    if document.tenant_id != user_ctx.tenant_id:
        return False
    if user_ctx.is_admin():
        return True
    if document.visibility == Document.Visibility.TENANT:
        return True
    if document.owner_id == user_ctx.user_id:
        return True
    if document.visibility == Document.Visibility.GROUP and user_ctx.group_ids:
        return document.permissions.filter(group_id__in=user_ctx.group_ids).exists()
    return False


def can_delete_document(user_ctx: UserContext, document: Document) -> bool:
    """
    Evaluates whether user_ctx is authorized to delete the document.
    Only the document owner or a Tenant Admin can delete.
    """
    if document.tenant_id != user_ctx.tenant_id:
        return False
    return user_ctx.is_admin() or document.owner_id == user_ctx.user_id
