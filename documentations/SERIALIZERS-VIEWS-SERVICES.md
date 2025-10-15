# Django REST Framework Architecture Guide: Serializers, Views, Services

This guide provides a comprehensive explanation of Serializers, Views, and Services in Django REST Framework, covering their roles, differences, collaboration patterns, and best practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Serializers](#serializers)
3. [Views](#views)
4. [Services](#services)
5. [Three-Layer Collaboration](#three-layer-collaboration)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)
8. [Anti-patterns](#anti-patterns)
9. [Quick Checklist](#quick-checklist)

## Architecture Overview

In Django REST Framework projects, we follow a three-layer architecture:

```
HTTP Request → View → Service → Model
     ↑                           ↓
HTTP Response ← Serializer ← Service ← Model
```

- **View**: Handles HTTP requests/responses, permission control, routing
- **Service**: Business logic, data consistency, complex operations
- **Serializer**: Data validation, format conversion, field mapping

## Serializers

### Definition and Purpose

**Serializer** is the data transformation and validation layer responsible for:
- Converting Python objects to JSON (serialization)
- Converting JSON to Python objects (deserialization)
- Validating input data format and business rules
- Controlling API field exposure and hiding

### Core Responsibilities

1. **Data Validation**: Ensure input data conforms to expected format and rules
2. **Data Transformation**: Map between model fields and API fields
3. **Field Control**: Determine which fields are readable/writable
4. **Error Handling**: Provide clear validation error messages

### Basic Example

```python
from rest_framework import serializers
from .models import CourseReview

class CourseReviewSerializer(serializers.ModelSerializer):
    # Computed field (read-only)
    author_name = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = CourseReview
        fields = [
            'id', 'content', 'rating', 'author_name', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_author_name(self, obj):
        return obj.author.username
    
    def validate_rating(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("Rating must be between 1-5")
        return value
    
    def validate(self, attrs):
        if len(attrs.get('content', '')) < 10:
            raise serializers.ValidationError({
                'content': 'Review content must be at least 10 characters'
            })
        return attrs
```

### Advanced Patterns

#### Nested Serializers
```python
class CourseSerializer(serializers.ModelSerializer):
    reviews = CourseReviewSerializer(many=True, read_only=True)
    teacher_names = serializers.StringRelatedField(
        source='teachers', many=True, read_only=True
    )
    
    class Meta:
        model = Course
        fields = ['id', 'name', 'department', 'reviews', 'teacher_names']
```

#### Conditional Fields
```python
class CourseReviewSerializer(serializers.ModelSerializer):
    can_edit = serializers.SerializerMethodField()
    
    def get_can_edit(self, obj):
        request = self.context.get('request')
        return request and request.user == obj.author
```

## Views

### Definition and Purpose

**View** is the HTTP request handling center responsible for:
- Receiving and responding to HTTP requests
- Handling authentication and permission control
- Coordinating data queries and operations
- Calling services and serializers
- Returning formatted responses

### Core Responsibilities

1. **Route Handling**: Define API endpoints and HTTP methods
2. **Permission Control**: Verify user identity and operation permissions
3. **Data Querying**: Fetch, filter, and paginate data
4. **Business Coordination**: Call service layer to handle business logic
5. **Response Formatting**: Use serializers to format output

### Basic Example

```python
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import CourseReview
from .serializers import CourseReviewSerializer
from .services import create_course_review, update_course_review

class CourseReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = CourseReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return CourseReview.objects.filter(course_id=course_id)
    
    def perform_create(self, serializer):
        # Call service layer to handle business logic
        course = self.get_course()
        review = create_course_review(
            user=self.request.user,
            course=course,
            payload=serializer.validated_data
        )
        serializer.instance = review

class CourseReviewRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CourseReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        return CourseReview.objects.all()
    
    def perform_update(self, serializer):
        # Call service layer to handle update logic
        updated_review = update_course_review(
            review=serializer.instance,
            payload=serializer.validated_data
        )
        serializer.instance = updated_review
```

### Custom View Patterns

#### Custom Actions
```python
from rest_framework.decorators import action
from rest_framework.response import Response

class CourseReviewViewSet(viewsets.ModelViewSet):
    queryset = CourseReview.objects.all()
    serializer_class = CourseReviewSerializer
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        review = self.get_object()
        from .services import toggle_course_review_like
        
        is_liked = toggle_course_review_like(
            user=request.user,
            review=review
        )
        
        return Response({
            'is_liked': is_liked,
            'like_count': review.like_count
        })
```

## Services

### Definition and Purpose

**Service** is the business logic encapsulation layer responsible for:
- Implementing complex business rules and workflows
- Maintaining data consistency and integrity
- Handling cross-model association operations
- Managing transactions and side effects
- Defining domain-specific exceptions

### Core Responsibilities

1. **Business Logic**: Implement domain rules and business processes
2. **Data Consistency**: Ensure related models stay synchronized
3. **Transaction Management**: Handle atomicity of multi-step operations
4. **Side Effect Management**: Handle cleanup, notifications, caching, etc.
5. **Exception Handling**: Define and raise domain-specific exceptions

### Basic Example

```python
from django.db import transaction, IntegrityError
from django.contrib.auth import get_user_model
from .models import CourseReview, Course
from .exceptions import AlreadyReviewedError, CourseNotFoundError

User = get_user_model()

def create_course_review(user: User, course: Course, payload: dict) -> CourseReview:
    """Create a course review with complete business logic"""
    
    # Business rule validation
    if CourseReview.objects.filter(author=user, course=course).exists():
        raise AlreadyReviewedError("You have already reviewed this course")
    
    # Data sanitization
    if 'content' in payload:
        payload['content'] = sanitize_html(payload['content'])
    
    try:
        with transaction.atomic():
            # Create review
            review = CourseReview.objects.create(
                author=user,
                course=course,
                **payload
            )
            
            # Update related aggregate data
            recompute_course_aggregates_after_review_change(course=course)
            
            return review
            
    except IntegrityError as e:
        if _is_constraint_violation(e, "unique_course_review_per_user"):
            raise AlreadyReviewedError("You have already reviewed this course")
        raise

def update_course_review(review: CourseReview, payload: dict) -> CourseReview:
    """Update a course review"""
    
    with transaction.atomic():
        # Mark as edited
        mark_review_edited_if_fields_changed(review, payload)
        
        # Update fields
        for field, value in payload.items():
            setattr(review, field, value)
        
        review.save()
        
        # Recompute aggregate data
        recompute_course_aggregates_after_review_change(course=review.course)
        
        return review
```

### Service Organization Patterns

#### File Structure
```
services/
├── __init__.py                    # Public API exports
├── course_review_create.py        # Create-related services
├── course_review_update.py        # Update-related services
├── course_review_delete.py        # Delete-related services
├── course_review_read.py          # Query-related services
├── course_aggregates.py           # Aggregate data management
├── course_exceptions.py           # Domain exception definitions
├── course_utils.py                # Utility functions
└── course_notification.py         # Notification-related
```

#### Public API Pattern
```python
# services/__init__.py
from .course_review_create import create_course_review
from .course_review_update import update_course_review
from .course_review_delete import delete_course_review
from .course_aggregates import recompute_course_aggregates_after_review_change
from .course_exceptions import AlreadyReviewedError, CourseNotFoundError

__all__ = [
    # CRUD operations
    "create_course_review",
    "update_course_review", 
    "delete_course_review",
    
    # Aggregate management
    "recompute_course_aggregates_after_review_change",
    
    # Exceptions
    "AlreadyReviewedError",
    "CourseNotFoundError",
]
```

### Domain Exception Patterns

```python
# services/course_exceptions.py
class ServiceError(Exception):
    """Base class for service layer exceptions"""
    pass

class ValidationError(ServiceError):
    """Validation-related exceptions"""
    pass

class AlreadyReviewedError(ValidationError):
    """Duplicate review exception"""
    pass

class NotFoundError(ServiceError):
    """Resource not found exception"""
    pass

class CourseNotFoundError(NotFoundError):
    """Course not found exception"""
    pass
```

## Three-Layer Collaboration

### Complete Flow Example

```python
# 1. View Layer: Handle HTTP request
class CourseReviewCreateView(generics.CreateAPIView):
    serializer_class = CourseReviewSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        # 2. Call Service layer to handle business logic
        course = self.get_course()
        review = create_course_review(
            user=self.request.user,
            course=course,
            payload=serializer.validated_data
        )
        # 3. Set serializer instance for response
        serializer.instance = review

# 4. Service Layer: Handle business logic
def create_course_review(user, course, payload):
    # Business validation
    if CourseReview.objects.filter(author=user, course=course).exists():
        raise AlreadyReviewedError("You have already reviewed this course")
    
    with transaction.atomic():
        # Create data
        review = CourseReview.objects.create(
            author=user, course=course, **payload
        )
        # Update aggregate data
        recompute_course_aggregates_after_review_change(course)
        return review

# 5. Serializer Layer: Data validation and formatting
class CourseReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseReview
        fields = ['content', 'rating']
    
    def validate_rating(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("Rating must be between 1-5")
        return value
```

### Error Handling Flow

```python
# View layer error handling
class CourseReviewCreateView(generics.CreateAPIView):
    def perform_create(self, serializer):
        try:
            review = create_course_review(
                user=self.request.user,
                course=self.get_course(),
                payload=serializer.validated_data
            )
            serializer.instance = review
        except AlreadyReviewedError as e:
            raise ValidationError(str(e))
        except CourseNotFoundError as e:
            raise NotFound(str(e))
```

## Best Practices

### Serializer Best Practices

1. **Explicit Field Definition**
   ```python
   class Meta:
       fields = ['id', 'name', 'content']  # Explicit list, avoid __all__
   ```

2. **Use Read-only/Write-only Fields**
   ```python
   class Meta:
       read_only_fields = ['id', 'created_at']
       write_only_fields = ['password']
   ```

3. **Provide Clear Validation Errors**
   ```python
   def validate_content(self, value):
       if len(value) < 10:
           raise serializers.ValidationError("Content must be at least 10 characters")
       return value
   ```

4. **Use Context to Pass Request Information**
   ```python
   def get_can_edit(self, obj):
       request = self.context.get('request')
       return request and request.user == obj.author
   ```

### View Best Practices

1. **Use Generic View Classes**
   ```python
   class CourseReviewViewSet(viewsets.ModelViewSet):
       queryset = CourseReview.objects.all()
       serializer_class = CourseReviewSerializer
   ```

2. **Permission Control**
   ```python
   permission_classes = [permissions.IsAuthenticatedOrReadOnly]
   ```

3. **Pagination and Filtering**
   ```python
   pagination_class = PageNumberPagination
   filter_backends = [DjangoFilterBackend, SearchFilter]
   ```

4. **Custom QuerySets**
   ```python
   def get_queryset(self):
       return CourseReview.objects.filter(
           course_id=self.kwargs['course_id']
       ).select_related('author')
   ```

### Service Best Practices

1. **Single Responsibility Principle**
   ```python
   # Good practice: Each function has a clear responsibility
   def create_course_review(user, course, payload):
       pass
   
   def update_course_review(review, payload):
       pass
   ```

2. **Transaction Management**
   ```python
   def complex_operation():
       with transaction.atomic():
           # Multiple related operations
           pass
   ```

3. **Exception Handling**
   ```python
   def create_review(user, course, payload):
       try:
           return CourseReview.objects.create(...)
       except IntegrityError as e:
           if _is_constraint_violation(e, "unique_constraint"):
               raise AlreadyReviewedError("Duplicate review")
           raise
   ```

4. **Side Effect Management**
   ```python
   def delete_review(review):
       with transaction.atomic():
           # Delete review
           review.delete()
           # Update aggregate data
           recompute_course_aggregates_after_review_change(review.course)
           # Clean up related resources
           cleanup_review_images(review)
   ```

## Common Patterns

### 1. Computed Field Pattern
```python
class CourseReviewSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    
    def get_author_name(self, obj):
        return obj.author.username
    
    def get_like_count(self, obj):
        return obj.likes.count()
```

### 2. Conditional Serialization Pattern
```python
class CourseReviewSerializer(serializers.ModelSerializer):
    can_edit = serializers.SerializerMethodField()
    
    def get_can_edit(self, obj):
        request = self.context.get('request')
        return request and request.user == obj.author
```

### 3. Nested Creation Pattern
```python
class CourseSerializer(serializers.ModelSerializer):
    reviews = CourseReviewSerializer(many=True, required=False)
    
    def create(self, validated_data):
        reviews_data = validated_data.pop('reviews', [])
        course = Course.objects.create(**validated_data)
        
        for review_data in reviews_data:
            CourseReview.objects.create(course=course, **review_data)
        
        return course
```

### 4. Service Layer Aggregate Pattern
```python
def recompute_course_aggregates_after_review_change(course: Course):
    """Recompute course aggregate data"""
    with transaction.atomic():
        # Calculate average rating
        course.average_rating = course.reviews.aggregate(
            avg_rating=Avg('rating')
        )['avg_rating'] or 0
        
        # Calculate review count
        course.review_count = course.reviews.count()
        
        course.save()
        
        # Update teacher aggregate data
        for teacher in course.teachers.all():
            recompute_teacher_aggregates(teacher)
```

## Anti-patterns

### Practices to Avoid

1. **Handling Business Logic in Serializers**
   ```python
   # Wrong approach
   class CourseReviewSerializer(serializers.ModelSerializer):
       def create(self, validated_data):
           # Complex business logic shouldn't be here
           if some_complex_business_rule():
               # Handle business logic
               pass
   ```

2. **Direct Database Operations in Views**
   ```python
   # Wrong approach
   class CourseReviewCreateView(generics.CreateAPIView):
       def perform_create(self, serializer):
           # Direct database operations without business logic encapsulation
           CourseReview.objects.create(...)
   ```

3. **Handling HTTP-related Logic in Services**
   ```python
   # Wrong approach
   def create_review(request):
       # Service layer shouldn't know about HTTP requests
       user = request.user
   ```

4. **Using `__all__` to Expose All Fields**
   ```python
   # Wrong approach
   class Meta:
       fields = '__all__'  # May expose sensitive information
   ```
