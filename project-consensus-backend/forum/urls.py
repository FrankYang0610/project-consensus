from rest_framework.routers import SimpleRouter
from .views import ForumPostViewSet, ForumPostCommentViewSet


router = SimpleRouter()
router.register(r"posts", ForumPostViewSet, basename="forum-post")
router.register(r"comments", ForumPostCommentViewSet, basename="forum-comment")

urlpatterns = router.urls

