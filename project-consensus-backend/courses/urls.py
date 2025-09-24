from rest_framework.routers import SimpleRouter
from .views import CourseViewSet, CourseReviewViewSet, CourseReviewReplyViewSet


router = SimpleRouter()
router.register(r"courses", CourseViewSet, basename="course")
router.register(r"reviews", CourseReviewViewSet, basename="course-review")
router.register(r"replies", CourseReviewReplyViewSet, basename="course-review-reply")

urlpatterns = router.urls

