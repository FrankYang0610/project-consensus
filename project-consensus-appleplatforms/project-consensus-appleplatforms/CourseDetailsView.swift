import SwiftUI

// MARK: - Course Detail View

struct CourseDetailView: View {
    let course: Course
    let initialReviewId: String?

    @State private var reviews: [CourseReview] = []
    @State private var isLoadingReviews = true
    @State private var reviewsError: String?
    @State private var currentPage = 1
    @State private var hasMore = true
    @State private var selectedReview: CourseReview?
    @State private var pendingScrollAnchorId: String?

    init(course: Course, initialReviewId: String? = nil) {
        self.course = course
        self.initialReviewId = initialReviewId
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 20) {
                    headerCard
                    teachersCard
                    reviewsSection
                }
                .padding(.horizontal)
                .padding(.vertical, 12)
            }
            .onChange(of: pendingScrollAnchorId) { _, anchorId in
                guard let anchorId else { return }
                withAnimation {
                    proxy.scrollTo(anchorId, anchor: .center)
                }
                pendingScrollAnchorId = nil
            }
        }
        .navigationTitle(course.subjectCode)
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadReviews() }
        .sheet(item: $selectedReview) { review in
            NavigationStack {
                CourseReviewDetailView(review: review)
            }
        }
    }

    // MARK: - Header Card

    private var headerCard: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.fill")
                .font(.title)
                .foregroundStyle(.white)
                .frame(width: 60, height: 60)
                .background(.tint, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

            VStack(spacing: 4) {
                Text(course.subjectCode)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.tint)
                Text(course.title.localizedCapitalized)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 32) {
                statItem(
                    value: course.rating.reviewsCount > 0
                        ? String(format: "%.1f", course.rating.score) : "—",
                    label: "Rating"
                )
                statItem(
                    value: "\(course.rating.reviewsCount)",
                    label: "Reviews"
                )
                statItem(
                    value: course.credits,
                    label: "Credits"
                )
            }

            infoTagsRow
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
    }

    private var infoTagsRow: some View {
        VStack(spacing: 4) {
            Text(course.department.localizedCapitalized)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .center)

            Text(courseMetaInfo)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.weight(.bold).monospacedDigit())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var courseMetaInfo: String {
        var parts = ["Level \(course.level)"]
        if !course.teachingType.isEmpty {
            parts.append(course.teachingType.localizedCapitalized)
        }
        if !course.courseCategory.isEmpty {
            parts.append(course.courseCategory.localizedCapitalized)
        }
        return parts.joined(separator: " / ")
    }

    // MARK: - Teachers Card

    private var teachersCard: some View {
        cardContainer(title: "Teachers", systemImage: "person.2") {
            if course.teachers.isEmpty {
                Text("No teachers listed.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 10) {
                    ForEach(course.teachers) { teacher in
                        NavigationLink {
                            TeacherDetailsView(teacherId: teacher.id)
                        } label: {
                            HStack(spacing: 12) {
                                courseTeacherAvatar(teacher)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(teacher.name)
                                        .font(.subheadline.weight(.medium))
                                    if let dept = teacher.department {
                                        Text(dept.localizedCapitalized)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                            .padding(12)
                            .background(.gray.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func courseTeacherAvatar(_ teacher: CourseTeacher) -> some View {
        Group {
            if let urlStr = teacher.avatarUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsCircle(for: teacher.name)
                    }
                }
            } else {
                initialsCircle(for: teacher.name)
            }
        }
        .frame(width: 36, height: 36)
        .clipShape(Circle())
    }

    // MARK: - Reviews Section

    private var reviewsSection: some View {
        cardContainer(title: "Reviews", systemImage: "star.bubble") {
            if isLoadingReviews && reviews.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 80)
            } else if let error = reviewsError, reviews.isEmpty {
                VStack(spacing: 8) {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Retry") { Task { await loadReviews() } }
                        .font(.subheadline)
                }
                .frame(maxWidth: .infinity)
            } else if reviews.isEmpty {
                Text("No reviews yet. Be the first to share your thoughts!")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 60)
            } else {
                VStack(spacing: 12) {
                    ForEach(reviews) { review in
                        Button { selectedReview = review } label: {
                            CourseReviewCard(review: review)
                        }
                        .buttonStyle(.plain)
                        .id(reviewAnchorId(review.id))
                    }

                    if hasMore {
                        Button {
                            Task { await loadMoreReviews() }
                        } label: {
                            Group {
                                if isLoadingReviews {
                                    ProgressView()
                                } else {
                                    Text("Load More Reviews")
                                        .font(.subheadline.weight(.medium))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                        }
                        .disabled(isLoadingReviews)
                    }
                }
            }
        }
        .id(reviewsSectionAnchorId)
    }

    // MARK: - Shared Helpers

    private func cardContainer<Content: View>(
        title: String,
        systemImage: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(title, systemImage: systemImage)
                .font(.headline)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
    }

    private func initialsCircle(for name: String) -> some View {
        Circle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Text(String(name.prefix(1)).uppercased())
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }

    // MARK: - Data Loading

    private func loadReviews() async {
        isLoadingReviews = true
        reviewsError = nil
        do {
            let response: PaginatedResponse<CourseReview> = try await APIService.shared.get(
                "/reviews/",
                queryItems: [
                    "courseId": course.courseId,
                    "ordering": "-updated_at",
                    "page": "1",
                    "page_size": "10"
                ]
            )
            reviews = response.results
            hasMore = response.next != nil
            currentPage = 1
            prepareInitialScrollIfNeeded()
        } catch {
            reviewsError = error.localizedDescription
        }
        isLoadingReviews = false
    }

    private func loadMoreReviews() async {
        guard hasMore, !isLoadingReviews else { return }
        isLoadingReviews = true
        let nextPage = currentPage + 1
        do {
            let response: PaginatedResponse<CourseReview> = try await APIService.shared.get(
                "/reviews/",
                queryItems: [
                    "courseId": course.courseId,
                    "ordering": "-updated_at",
                    "page": "\(nextPage)",
                    "page_size": "10"
                ]
            )
            reviews.append(contentsOf: response.results)
            hasMore = response.next != nil
            currentPage = nextPage
        } catch {}
        isLoadingReviews = false
    }

    private var reviewsSectionAnchorId: String { "course-reviews-section" }

    private func reviewAnchorId(_ reviewId: String) -> String {
        "review-\(reviewId)"
    }

    private func prepareInitialScrollIfNeeded() {
        guard let initialReviewId else { return }
        if reviews.contains(where: { $0.id == initialReviewId }) {
            pendingScrollAnchorId = reviewAnchorId(initialReviewId)
        } else {
            pendingScrollAnchorId = reviewsSectionAnchorId
        }
    }
}
