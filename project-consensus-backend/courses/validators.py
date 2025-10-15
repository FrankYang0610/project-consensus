from __future__ import annotations

from rest_framework import serializers

from .models import Course, CourseReview, CourseReviewReply


def validate_curriculum_structure(value):
    """Validate the curriculum structure used by Course.curriculum.

    The curriculum must be a list of colleges, where each college is a dict with a
    "majors" key containing a list of majors. Each major is a dict with a
    "semesters" key containing a list of semesters. Each semester is a dict and
    may contain:
      - "year": int
      - "semester": "spring" | "summer" | "fall"
    """
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError("curriculum must be a list of colleges")
    for college in value:
        if not isinstance(college, dict):
            raise serializers.ValidationError("college entries must be objects")
        if "majors" not in college or not isinstance(college.get("majors"), list):
            raise serializers.ValidationError("college.majors must be a list")
        for major in college["majors"]:
            if not isinstance(major, dict):
                raise serializers.ValidationError("major must be an object")
            if "semesters" not in major or not isinstance(major.get("semesters"), list):
                raise serializers.ValidationError("major.semesters must be a list")
            for sem in major["semesters"]:
                if not isinstance(sem, dict):
                    raise serializers.ValidationError("semester must be an object")
                if "year" in sem and not isinstance(sem["year"], int):
                    raise serializers.ValidationError("semester.year must be integer")
                if "semester" in sem and sem["semester"] not in ("spring", "summer", "fall"):
                    raise serializers.ValidationError("semester.semester must be one of: spring, summer, fall")
    return value


def validate_course_attributes_enum(attrs: dict) -> None:
    """Validate that provided course attribute enums are valid against Course choices.

    Expects a dict that may include keys: difficulty, workload, grading, gain.
    Raises ValidationError on invalid values.
    """
    if not isinstance(attrs, dict):
        return
    valid_difficulty = {c[0] for c in Course.Difficulty.choices}
    valid_workload = {c[0] for c in Course.Workload.choices}
    valid_grading = {c[0] for c in Course.Grading.choices}
    valid_gain = {c[0] for c in Course.Gain.choices}
    for key, valid in (
        ("difficulty", valid_difficulty),
        ("workload", valid_workload),
        ("grading", valid_grading),
        ("gain", valid_gain),
    ):
        if key in attrs and attrs[key] not in valid:
            raise serializers.ValidationError({"attributes": f"{key} must be one of: {', '.join(sorted(valid))}"})


def validate_course_review_creation(attrs: dict, initial_data: dict) -> dict:
    """Validate course review creation with business rules."""
    only_text = attrs.get("only_text", False)
    
    if not only_text:
        # For rated reviews, validate required fields
        overall_rating = attrs.get("overall_rating")
        if overall_rating is None:
            # Try to get from initial_data
            overall_rating = initial_data.get("overallRating")
            if overall_rating is not None:
                try:
                    overall_rating = float(overall_rating)
                except (ValueError, TypeError):
                    raise serializers.ValidationError({"overallRating": "must be a number"})
        
        if overall_rating is None:
            raise serializers.ValidationError({"overallRating": "required when onlyText is false"})
        
        if not (1 <= overall_rating <= 10):
            raise serializers.ValidationError({"overallRating": "must be between 1 and 10"})
        
        # Validate attributes
        attrs_dict = initial_data.get("attributes")
        if not isinstance(attrs_dict, dict):
            raise serializers.ValidationError({"attributes": "required when onlyText is false"})
        
        for key in ("difficulty", "workload", "grading", "gain"):
            if key not in attrs_dict or not isinstance(attrs_dict[key], str):
                raise serializers.ValidationError({"attributes": f"{key} is required when onlyText is false"})
        
        validate_course_attributes_enum(attrs_dict)
        
        # Extract and map attributes to model fields
        attrs["attr_difficulty"] = attrs_dict.get("difficulty")
        attrs["attr_workload"] = attrs_dict.get("workload")
        attrs["attr_grading"] = attrs_dict.get("grading")
        attrs["attr_gain"] = attrs_dict.get("gain")
        
        # Extract and map term
        term = initial_data.get("term")
        if isinstance(term, dict):
            if "year" in term and isinstance(term["year"], int):
                attrs["term_year"] = term["year"]
            if "semester" in term and term["semester"] in ("spring", "summer", "fall"):
                attrs["term_semester"] = term["semester"]
    else:
        # For text-only reviews, set rating to 0
        attrs["overall_rating"] = 0
        
        # Disallow rating/attributes in payload
        if "overallRating" in initial_data and initial_data.get("overallRating") not in (None, ""):
            raise serializers.ValidationError({"overallRating": "must be omitted when onlyText is true"})
        
        attrs_dict = initial_data.get("attributes")
        if isinstance(attrs_dict, dict) and attrs_dict:
            raise serializers.ValidationError({"attributes": "must be omitted when onlyText is true"})
    
    return attrs


def validate_course_review_update(attrs: dict, initial_data: dict, instance: CourseReview) -> dict:
    """Validate course review update with business rules."""
    only_text = attrs.get("only_text", instance.only_text)
    
    if not only_text:
        # For rated reviews, validate rating if provided
        overall_rating = attrs.get("overall_rating")
        if overall_rating is None and "overallRating" in initial_data:
            try:
                overall_rating = float(initial_data.get("overallRating"))
            except (ValueError, TypeError):
                raise serializers.ValidationError({"overallRating": "must be a number"})
        
        if overall_rating is not None:
            if not (1 <= overall_rating <= 10):
                raise serializers.ValidationError({"overallRating": "must be between 1 and 10"})
            attrs["overall_rating"] = overall_rating
        
        # Validate attributes if provided
        attrs_dict = initial_data.get("attributes")
        if isinstance(attrs_dict, dict):
            for key in ("difficulty", "workload", "grading", "gain"):
                if key in attrs_dict and not isinstance(attrs_dict[key], str):
                    raise serializers.ValidationError({"attributes": f"{key} must be a string"})
            
            validate_course_attributes_enum(attrs_dict)
            
            # Map attributes to model fields
            for key, field in (
                ("difficulty", "attr_difficulty"),
                ("workload", "attr_workload"),
                ("grading", "attr_grading"),
                ("gain", "attr_gain"),
            ):
                if key in attrs_dict:
                    attrs[field] = attrs_dict[key]
        
        # Extract and map term if provided
        term = initial_data.get("term")
        if isinstance(term, dict):
            if "year" in term and isinstance(term["year"], int):
                attrs["term_year"] = term["year"]
            if "semester" in term and term["semester"] in ("spring", "summer", "fall"):
                attrs["term_semester"] = term["semester"]
    else:
        # For text-only reviews, set rating to 0
        if "only_text" in attrs and attrs["only_text"]:
            attrs["overall_rating"] = 0
        
        # Disallow rating/attributes in payload
        if "overallRating" in initial_data and initial_data.get("overallRating") not in (None, ""):
            raise serializers.ValidationError({"overallRating": "must be omitted when onlyText is true"})
        
        attrs_dict = initial_data.get("attributes")
        if isinstance(attrs_dict, dict) and attrs_dict:
            raise serializers.ValidationError({"attributes": "must be omitted when onlyText is true"})
    
    return attrs


def validate_course_review_reply_creation(attrs: dict, initial_data: dict) -> dict:
    """Validate course review reply creation with business rules."""
    # Basic content validation
    content = attrs.get("content", "")
    if not content or not content.strip():
        raise serializers.ValidationError({"content": "content is required"})
    
    return attrs


