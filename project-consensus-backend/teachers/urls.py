from rest_framework.routers import SimpleRouter
from .views import TeacherViewSet


router = SimpleRouter()
router.register(r"teachers", TeacherViewSet, basename="teacher")

urlpatterns = router.urls

