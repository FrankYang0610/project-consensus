import SwiftUI

struct LatestCourseReviewsView: View {
    @State private var reviews: [CourseReview] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var currentPage = 1
    @State private var hasMore = true
    @State private var showBetaInfo = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && reviews.isEmpty {
                    ProgressView("Loading reviews...")
                } else if let errorMessage, reviews.isEmpty {
                    ContentUnavailableView {
                        Label("Failed to Load", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("Retry") { Task { await loadReviews() } }
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            ForEach(reviews) { review in
                                NavigationLink {
                                    CourseReviewDestinationView(review: review)
                                } label: {
                                    CourseReviewPreviewCard(review: review)
                                }
                                .buttonStyle(.plain)
                            }
                            if hasMore {
                                ProgressView()
                                    .padding()
                                    .task { await loadMore() }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top, 8)
                    }
                }
            }
            .navigationTitle("Latest Reviews")
            .toolbar {
                ToolbarItem(placement: .secondaryAction) {
                    Button {
                        showBetaInfo = true
                    } label: {
                        Image(systemName: "info.circle")
                    }
                    .accessibilityLabel("Beta feature info")
                }
            }
            .alert("Beta Notice", isPresented: $showBetaInfo) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("This app is currently in beta. Account login, posting and liking, and translation are not supported yet. Forum post content and course review content currently support text-only display.")
            }
            .task { await loadReviews() }
        }
    }

    private func loadReviews() async {
        isLoading = true
        errorMessage = nil
        do {
            let response: PaginatedResponse<CourseReview> = try await APIService.shared.get(
                "/reviews/",
                queryItems: [
                    "ordering": "-updated_at",
                    "page": "1",
                    "page_size": "20"
                ]
            )
            reviews = response.results
            hasMore = response.next != nil
            currentPage = 1
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        let nextPage = currentPage + 1
        do {
            let response: PaginatedResponse<CourseReview> = try await APIService.shared.get(
                "/reviews/",
                queryItems: [
                    "ordering": "-updated_at",
                    "page": "\(nextPage)",
                    "page_size": "20"
                ]
            )
            reviews.append(contentsOf: response.results)
            hasMore = response.next != nil
            currentPage = nextPage
        } catch {}
        isLoading = false
    }
}

private struct CourseReviewDestinationView: View {
    let review: CourseReview

    @State private var course: Course?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let course {
                CourseDetailView(course: course, initialReviewId: review.id)
            } else if isLoading {
                ProgressView("Loading course...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView {
                    Label("Course Not Found", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(errorMessage ?? "Unable to load the course for this review.")
                } actions: {
                    Button("Retry") { Task { await loadCourse() } }
                }
            }
        }
        .task(id: review.id) { await loadCourse() }
    }

    private func loadCourse() async {
        if course != nil { return }
        isLoading = true
        errorMessage = nil
        do {
            course = try await APIService.shared.get("/courses/\(review.courseId)/")
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    LatestCourseReviewsView()
}
