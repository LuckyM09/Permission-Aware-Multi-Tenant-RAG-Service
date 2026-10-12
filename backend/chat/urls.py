from django.urls import path

from .views import (
    ChatMessageView,
    ConversationDetailView,
    ConversationListCreateView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view(), name="conversation_list_create"),
    path("conversations/<uuid:pk>/", ConversationDetailView.as_view(), name="conversation_detail"),
    path("message/", ChatMessageView.as_view(), name="chat_message"),
]
