import SwiftUI

struct TeachersView: View {
    @State private var teachers: [Teacher] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var currentPage = 1
    @State private var hasMore = true
    @State private var ordering = TeacherOrdering.name

    @State private var searchText = ""
    @State private var searchResults: [Teacher] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    private var isInSearchMode: Bool { !searchText.isEmpty }

    var body: some View {
        NavigationStack {
            Group {
                if isInSearchMode {
                    searchResultsView
                } else if isLoading && teachers.isEmpty {
                    ProgressView("Loading teachers...")
                } else if let errorMessage, teachers.isEmpty {
                    ContentUnavailableView {
                        Label("Failed to Load", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("Retry") { Task { await loadTeachers() } }
                    }
                } else {
                    teacherListView
                }
            }
            .navigationTitle("Teachers")
            .searchable(text: $searchText, prompt: "Search by name")
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
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Sort", selection: $ordering) {
                            ForEach(TeacherOrdering.allCases) { option in
                                Text(option.label).tag(option)
                            }
                        }
                    } label: {
                        Label("Sort", systemImage: "arrow.up.arrow.down")
                    }
                }
            }
            .onChange(of: ordering) { _, _ in
                Task { await loadTeachers() }
            }
            .task { await loadTeachers() }
        }
    }

    private var teacherListView: some View {
        List {
            ForEach(teachers) { teacher in
                NavigationLink {
                    TeacherDetailsView(teacherId: teacher.id)
                } label: {
                    TeacherRow(teacher: teacher)
                }
            }
            if hasMore {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .task { await loadMore() }
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
                List(searchResults) { teacher in
                    NavigationLink {
                        TeacherDetailsView(teacherId: teacher.id)
                    } label: {
                        TeacherRow(teacher: teacher)
                    }
                }
            }
        }
    }

    private var queryParams: [String: String] {
        var params: [String: String] = ["page_size": "30"]
        params["ordering"] = ordering.apiValue
        return params
    }

    private func loadTeachers() async {
        isLoading = true
        errorMessage = nil
        do {
            var params = queryParams
            params["page"] = "1"
            let response: PaginatedResponse<Teacher> = try await APIService.shared.get(
                "/teachers/",
                queryItems: params
            )
            teachers = response.results
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
            var params = queryParams
            params["page"] = "\(nextPage)"
            let response: PaginatedResponse<Teacher> = try await APIService.shared.get(
                "/teachers/",
                queryItems: params
            )
            teachers.append(contentsOf: response.results)
            hasMore = response.next != nil
            currentPage = nextPage
        } catch {}
        isLoading = false
    }

    private func performSearch(query: String) async {
        isSearching = true
        do {
            let response: PaginatedResponse<Teacher> = try await APIService.shared.get(
                "/teachers/",
                queryItems: ["search": query, "page_size": "30"]
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

// MARK: - Teacher Row

struct TeacherRow: View {
    let teacher: Teacher

    var body: some View {
        HStack(spacing: 12) {
            TeacherAvatar(teacher: teacher, size: 44)

            VStack(alignment: .leading, spacing: 4) {
                Text(teacher.name)
                    .font(.body)
                Text(teacher.department.localizedCapitalized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Teacher Avatar

struct TeacherAvatar: View {
    let teacher: Teacher
    let size: CGFloat

    var body: some View {
        if teacher.hasRealAvatar, let url = URL(string: teacher.avatarUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    initialsView
                }
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        } else {
            initialsView
        }
    }

    private var initialsView: some View {
        Circle()
            .fill(.gray.opacity(0.2))
            .frame(width: size, height: size)
            .overlay {
                Text(teacher.avatarUrl.prefix(2))
                    .font(.system(size: size * 0.36, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }
}

// MARK: - Sort Options

enum TeacherOrdering: String, CaseIterable, Identifiable {
    case name
    case department
    case highestRating
    case mostReviews
    case recentlyUpdated

    var id: String { rawValue }

    var label: String {
        switch self {
        case .name: "Name"
        case .department: "Department"
        case .highestRating: "Highest Rating"
        case .mostReviews: "Most Reviews"
        case .recentlyUpdated: "Recently Updated"
        }
    }

    var apiValue: String {
        switch self {
        case .name: "name"
        case .department: "department"
        case .highestRating: "-rating_overall"
        case .mostReviews: "-rating_reviews_count"
        case .recentlyUpdated: "-updated_at"
        }
    }
}

#Preview {
    TeachersView()
}
