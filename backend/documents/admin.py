from django.contrib import admin

from .models import Chunk, Document, DocumentPermission


class DocumentPermissionInline(admin.TabularInline):
    model = DocumentPermission
    extra = 1


class ChunkInline(admin.TabularInline):
    model = Chunk
    extra = 0
    fields = ("position", "text", "created_at")
    readonly_fields = ("created_at",)
    show_change_link = True


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "tenant",
        "owner",
        "visibility",
        "status",
        "chunk_count",
        "created_at",
    )
    list_filter = ("status", "visibility", "tenant", "file_type")
    search_fields = ("title", "content_hash", "owner__email", "tenant__name")
    readonly_fields = (
        "content_hash",
        "file_size",
        "file_type",
        "created_at",
        "updated_at",
    )
    inlines = [DocumentPermissionInline, ChunkInline]


@admin.register(Chunk)
class ChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "tenant", "position", "created_at")
    list_filter = ("tenant",)
    search_fields = ("text", "document__title")
    readonly_fields = ("created_at",)


@admin.register(DocumentPermission)
class DocumentPermissionAdmin(admin.ModelAdmin):
    list_display = ("document", "group", "created_at")
    list_filter = ("group__tenant", "group")
    search_fields = ("document__title", "group__name")
