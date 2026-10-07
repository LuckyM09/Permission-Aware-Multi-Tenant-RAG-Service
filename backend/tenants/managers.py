import uuid

from django.db import models


class TenantScopedQuerySet(models.QuerySet):
    """
    QuerySet that provides explicit tenant filtering capabilities.
    """

    def for_tenant(self, tenant_id: uuid.UUID | str):
        """Filter queryset by tenant ID."""
        if not tenant_id:
            raise ValueError("A valid tenant_id is required to scope this query.")
        return self.filter(tenant_id=tenant_id)


class TenantScopedManager(models.Manager):
    """
    Manager that enforces tenant filtering on tenant-bound entities.
    """

    def get_queryset(self):
        return TenantScopedQuerySet(self.model, using=self._db)

    def for_tenant(self, tenant_id: uuid.UUID | str):
        return self.get_queryset().for_tenant(tenant_id)
