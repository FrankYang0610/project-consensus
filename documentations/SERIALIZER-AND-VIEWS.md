## Serializers vs Views (Django REST Framework)

This guide explains what serializers and views do, how they differ, how they work together, and the best practices to follow.

### What is a Serializer?

- **Purpose**: Convert data between Python objects (usually Django models) and transport formats (usually JSON). Also validates input data before it reaches your business logic.
- **Think of it as**: The translator and gatekeeper for your API data.

Typical responsibilities:
- **Validation**: Ensure incoming data is correctly shaped and meets rules (types, required fields, custom checks).
- **Transformation**: Map model fields to API fields, hide internal fields, or compute extra fields.
- **Deserialization**: Turn request JSON into validated Python data.
- **Serialization**: Turn Python objects into JSON for responses.

Minimal example:
```python
from rest_framework import serializers
from .models import Post

class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ["id", "title", "content", "created_at"]

    def validate_title(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Title is too short.")
        return value
```

### What is a View?

- **Purpose**: Handle HTTP requests and responses. Orchestrates authentication, permissions, querying, pagination, and uses serializers to validate/format data.
- **Think of it as**: The controller/traffic manager for API endpoints.

Typical responsibilities:
- **Routing**: Define endpoints and HTTP methods (GET, POST, etc.).
- **Access control**: Apply authentication and permission checks.
- **Querying**: Fetch, filter, or update database records.
- **Serialization step**: Call the serializer for validation and output formatting.

Minimal example:
```python
from rest_framework import generics, permissions
from .models import Post
from .serializers import PostSerializer

class PostListCreateView(generics.ListCreateAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
```

### How They Work Together

1. Client sends an HTTP request to a view.
2. The view handles auth/permissions and fetches/creates/updates data.
3. The view instantiates a serializer:
   - For input: `serializer = Serializer(data=request.data)` then `is_valid()`.
   - For output: `serializer = Serializer(instance=queryset_or_object, many=True/False)`.
4. The serializer validates/translates data.
5. The view returns a response (usually JSON) using the serializer’s output.

### Key Differences

- **Responsibility**:
  - Serializer: data validation and transformation.
  - View: request handling and orchestration.
- **Concerns**:
  - Serializer: shapes fields, rules, and errors.
  - View: routing, permissions, query logic, responses.
- **Testing focus**:
  - Serializer tests: validate rules and field mappings.
  - View tests: verify endpoints, permissions, status codes, and overall flow.

### Best Practices

- **Keep responsibilities separate**
  - Put validation and field logic in the serializer, not the view.
  - Put HTTP, permissions, and DB orchestration in the view, not the serializer.

- **Prefer ModelSerializer for models**
  - Reduces boilerplate, leverages DRF conventions.

- **Use explicit `fields` and avoid `__all__`**
  - Expose only what the API needs. This prevents accidental data leaks.

- **Write clear validation**
  - Use `validate_<field>` and `validate` methods.
  - Return precise error messages for better client UX.

- **Leverage generic views and mixins**
  - `ListCreateAPIView`, `RetrieveUpdateDestroyAPIView`, etc., keep your code consistent and compact.

- **Paginate, filter, and sort in views**
  - Keep input/output shape in serializers; keep data retrieval logic in views.

- **Use `read_only` and `write_only` fields**
  - Prevent clients from sending or receiving fields they shouldn’t.

- **Use serializer `context` when needed**
  - Pass `context={"request": request}` if validation or field computation needs request info.

- **Avoid business logic in serializers**
  - Complex domain logic should live in services or model methods. Serializers should orchestrate validation, not implement business workflows.

- **Consistent error shapes**
  - DRF already provides a good error format. Keep it consistent across endpoints.

### Common Patterns

Computed field (read-only):
```python
class PostSerializer(serializers.ModelSerializer):
    summary = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Post
        fields = ["id", "title", "content", "summary"]

    def get_summary(self, obj):
        return obj.content[:120]
```

Validation-only serializer, rely on default create/update:
```python
class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ["title", "content"]

    def validate(self, attrs):
        if attrs.get("title") and attrs.get("content") and attrs["title"] in attrs["content"]:
            raise serializers.ValidationError({"title": "Title should not repeat content."})
        return attrs
```

Set request-related fields in the view (not in the serializer):
```python
from rest_framework import viewsets

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
```

Class-based generic view with permissions and pagination:
```python
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination

class SmallPage(PageNumberPagination):
    page_size = 10

class PostListCreateView(generics.ListCreateAPIView):
    queryset = Post.objects.order_by("-id")
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = SmallPage
```

### Anti-patterns to Avoid

- Putting heavy business logic into serializers or views; use dedicated service functions.
- Using `__all__` in serializer `Meta.fields` for public APIs.
- Doing permission checks inside serializers; keep them in views/permissions classes.
- Silent data mutation in serializers without clear validation or explicit `create/update` methods.

### Quick Checklist

- Serializer handles: fields, validation, transformation.
- View handles: HTTP, permissions, querying, responses.
- Explicit fields, minimal side-effects, clear errors.
- Use DRF generics and pagination for consistency.
- Keep domain logic in services or models, not in serializers/views.

