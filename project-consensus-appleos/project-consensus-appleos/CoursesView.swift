import SwiftUI

private func formattedDepartmentName(_ name: String) -> String {
    var text = name.replacingOccurrences(of: "_", with: " ").localizedCapitalized
    text = text.replacingOccurrences(of: "\\bDepartment\\b", with: "Dept.", options: .regularExpression)
    text = text.replacingOccurrences(of: "\\bOf\\b", with: "of", options: .regularExpression)
    return text
}

// MARK: - Level 1: Department List

struct CoursesView: View {
    @State private var departments: [DepartmentWithOfferedCoursesCount] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    @State private var searchText = ""
    @State private var searchResults: [Course] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    private var isInSearchMode: Bool { !searchText.isEmpty }

    var body: some View {
        NavigationStack {
            Group {
                if isInSearchMode {
                    searchResultsView
                } else if isLoading {
                    ProgressView("Loading departments...")
                } else if let errorMessage {
                    ContentUnavailableView {
                        Label("Failed to Load", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("Retry") { Task { await loadDepartments() } }
                    }
                } else {
                    departmentListView
                }
            }
            .navigationTitle("Courses")
            .searchable(text: $searchText, prompt: "Search by code or title")
            .onChange(of: searchText) { _, newValue in
                searchTask?.cancel()
                if newValue.isEmpty {
                    searchResults = []
                    return
                }
                searchTask = Task {
                    try? await Task.sleep(for: .milliseconds(300))
                    guard !Task.isCancelled else { return }
                    await performSearch(query: newValue)
                }
            }
            .navigationDestination(for: DepartmentWithOfferedCoursesCount.self) { dept in
                DepartmentCoursesView(department: dept)
            }
            .navigationDestination(for: Course.self) { course in
                CourseDetailView(course: course)
            }
            .task { await loadDepartments() }
        }
    }

    private var departmentListView: some View {
        List(departments) { dept in
            NavigationLink(value: dept) {
                HStack {
                    Text(formattedDepartmentName(dept.name))
                        .font(.body)
                    Spacer()
                    Text("\(dept.count)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
    }

    private var searchResultsView: some View {
        Group {
            if isSearching {
                ProgressView("Searching...")
            } else if searchResults.isEmpty {
                ContentUnavailableView.search(text: searchText)
            } else {
                List(searchResults) { course in
                    NavigationLink(value: course) {
                        CourseRow(course: course)
                    }
                }
            }
        }
    }

    private func loadDepartments() async {
        isLoading = true
        errorMessage = nil
        do {
            let response: DepartmentsResponse = try await APIService.shared.get(
                "/courses/departments-with-counts/"
            )
            departments = response.departments
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func performSearch(query: String) async {
        isSearching = true
        do {
            let response: PaginatedResponse<Course> = try await APIService.shared.get(
                "/courses/",
                queryItems: [
                    "search": query,
                    "page_size": "30"
                ]
            )
            if !Task.isCancelled {
                searchResults = response.results
            }
        } catch {
            if !Task.isCancelled {
                searchResults = []
            }
        }
        if !Task.isCancelled {
            isSearching = false
        }
    }
}

// MARK: - Level 2: Course Level Selection

struct DepartmentCoursesView: View {
    let department: DepartmentWithOfferedCoursesCount

    private let levels = [
        ("1", "Level 1"),
        ("2", "Level 2"),
        ("3", "Level 3"),
        ("4", "Level 4"),
        ("5", "Level 5"),
        ("6", "Level 6"),
    ]

    var body: some View {
        List(levels, id: \.0) { level in
            NavigationLink(value: CourseQuery(department: department.name, level: level.0)) {
                Text(level.1)
                    .font(.body)
                    .padding(.vertical, 4)
            }
        }
        .navigationTitle(formattedDepartmentName(department.name))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: CourseQuery.self) { query in
            CourseLevelListView(query: query)
        }
    }
}

struct CourseQuery: Hashable {
    let department: String
    let level: String
}

// MARK: - Level 3: Course List for Department + Level

struct CourseLevelListView: View {
    let query: CourseQuery

    @State private var courses: [Course] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var currentPage = 1
    @State private var hasMore = true

    var body: some View {
        Group {
            if isLoading && courses.isEmpty {
                ProgressView("Loading courses...")
            } else if let errorMessage, courses.isEmpty {
                ContentUnavailableView {
                    Label("Failed to Load", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Retry") { Task { await loadCourses() } }
                }
            } else if courses.isEmpty {
                ContentUnavailableView("No Courses", systemImage: "book")
            } else {
                List {
                    ForEach(courses) { course in
                        NavigationLink(value: course) {
                            CourseRow(course: course)
                        }
                    }
                    if hasMore {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .task { await loadMore() }
                    }
                }
            }
        }
        .navigationTitle("Level \(query.level)")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Course.self) { course in
            CourseDetailView(course: course)
        }
        .task { await loadCourses() }
    }

    private func loadCourses() async {
        isLoading = true
        errorMessage = nil
        currentPage = 1
        do {
            let response: PaginatedResponse<Course> = try await APIService.shared.get(
                "/courses/",
                queryItems: [
                    "departments": query.department,
                    "level": query.level,
                    "page": "1",
                    "page_size": "20"
                ]
            )
            courses = response.results
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
            let response: PaginatedResponse<Course> = try await APIService.shared.get(
                "/courses/",
                queryItems: [
                    "departments": query.department,
                    "level": query.level,
                    "page": "\(nextPage)",
                    "page_size": "20"
                ]
            )
            courses.append(contentsOf: response.results)
            hasMore = response.next != nil
            currentPage = nextPage
        } catch {}
        isLoading = false
    }
}

// MARK: - Course Row

struct CourseRow: View {
    let course: Course

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(course.subjectCode)
                .font(.headline)
                .foregroundStyle(.tint)
            Text(course.title.localizedCapitalized)
                .font(.subheadline)
            HStack(spacing: 12) {
                if course.rating.reviewsCount > 0 {
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill")
                        Text(String(format: "%.1f", course.rating.score))
                    }
                    .font(.caption)
                    .foregroundStyle(.orange)
                }
                if !course.teachers.isEmpty {
                    HStack(spacing: 3) {
                        Image(systemName: "person")
                        Text(course.teachers.map(\.name).joined(separator: ", "))
                            .lineLimit(1)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Hashable Conformance

extension DepartmentWithOfferedCoursesCount: Hashable {
    static func == (lhs: DepartmentWithOfferedCoursesCount, rhs: DepartmentWithOfferedCoursesCount) -> Bool {
        lhs.name == rhs.name
    }
    func hash(into hasher: inout Hasher) {
        hasher.combine(name)
    }
}

extension Course: Hashable {
    static func == (lhs: Course, rhs: Course) -> Bool {
        lhs.courseId == rhs.courseId
    }
    func hash(into hasher: inout Hasher) {
        hasher.combine(courseId)
    }
}

#Preview {
    CoursesView()
}
