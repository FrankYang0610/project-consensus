import Foundation

// MARK: - Department

/// A department paired with the number of courses it offers.
struct DepartmentWithOfferedCoursesCount: Decodable, Identifiable {
    let name: String
    let count: Int  // Total number of courses belonging to this department.

    var id: String { name }

    var displayName: String {
        name.localizedCapitalized
    }
}

struct DepartmentsResponse: Decodable {
    let departments: [DepartmentWithOfferedCoursesCount]
}

// MARK: - Course

struct CourseRating: Decodable {
    let score: Double
    let reviewsCount: Int
}

struct CourseTeacher: Decodable, Identifiable {
    let id: String
    let name: String
    let avatarUrl: String?
    let department: String?
}

struct Course: Decodable, Identifiable {
    let courseId: String
    let subjectCode: String
    let title: String
    let department: String
    let level: String
    let credits: String
    let teachingType: String
    let courseCategory: String
    let rating: CourseRating
    let teachers: [CourseTeacher]

    var id: String { courseId }
}

// MARK: - Course Review

struct CourseReviewAuthor: Decodable {
    let id: String?
    let name: String
    let avatarUrl: String?
}

struct CourseReviewAttributes: Decodable {
    let difficulty: String?
    let workload: String?
    let grading: String?
    let gain: String?
}

struct CourseReviewTerm: Decodable {
    let year: Int
    let semester: String

    var displayText: String {
        let sem: String
        switch semester {
        case "spring": sem = "Spring"
        case "summer": sem = "Summer"
        case "fall": sem = "Fall"
        default: sem = semester.capitalized
        }
        return "\(year) \(sem)"
    }
}

struct CourseReview: Decodable, Identifiable {
    let id: String
    let courseId: String
    let courseSubjectCode: String
    let courseTitle: String
    let author: CourseReviewAuthor?
    let overallRating: Double
    let attributes: CourseReviewAttributes?
    let content: String
    let likesCount: Int
    let createdAt: String
    let updatedAt: String
    let term: CourseReviewTerm?
    let repliesCount: Int
    let isLiked: Bool
    let isAnonymous: Bool
    let isEdited: Bool
}

// MARK: - Teacher

struct TeacherRating: Decodable {
    let overall: Double?
    let difficulty: Double?
    let friendliness: Double?
    let clarity: Double?
    let grading: String?
    let reviewsCount: Int
}

struct CoTeacher: Decodable {
    let id: String
    let name: String
}

struct Teacher: Decodable, Identifiable {
    let id: String
    let name: String
    let title: String
    let department: String
    let avatarUrl: String
    let email: String
    let phone: String?
    let office: String?
    let officeHours: String?
    let websiteName: String?
    let websiteUrl: String?
    let profileUrl: String?
    let scholarsHubUrl: String?
    let biography: String?
    let researchInterests: String?
    let academicAndProfessionalExperience: String?
    let professionalQualifications: String?
    let tags: [String]?
    let languages: [String]?
    let rating: TeacherRating

    var hasRealAvatar: Bool {
        avatarUrl.hasPrefix("http")
    }
}

struct TeacherCourseRef: Decodable, Identifiable {
    let courseId: String
    let subjectCode: String?
    let title: String?
    let term: CourseReviewTerm?
    let terms: [CourseReviewTerm]?
    let coTeachers: [CoTeacher]?

    var id: String { courseId }
}

// MARK: - Course Review Reply

struct CourseReviewReply: Decodable, Identifiable {
    let id: String
    let reviewId: String
    let author: CourseReviewAuthor?
    let content: String
    let createdAt: String
    let likes: Int
    let isLiked: Bool
    let replyTo: String?
    let isDeleted: Bool
    let isAnonymous: Bool
}

// MARK: - Forum Post

struct ForumPostAuthor: Decodable, Hashable {
    let id: String?
    let name: String
    let avatar: String?
}

struct ForumPost: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let content: String
    let author: ForumPostAuthor
    let createdAt: String
    let updatedAt: String
    let tags: [String]
    let likesCount: Int
    let commentsCount: Int
    let isLiked: Bool
    let isAnonymous: Bool
    let isEdited: Bool
}

struct ForumPostComment: Decodable, Identifiable {
    let id: String
    let postId: String
    let author: ForumPostAuthor?
    let content: String
    let createdAt: String
    let likesCount: Int
    let isLiked: Bool
    let isDeleted: Bool
    let replyTo: String?
    let repliesCount: Int
    let isAnonymous: Bool
}
