import SwiftUI

struct ForumView: View {
    @State private var posts: [ForumPost] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var currentPage = 1
    @State private var hasMore = true
    @State private var ordering = ForumOrdering.newest

    @State private var searchText = ""
    @State private var searchResults: [ForumPost] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?
    private var isInSearchMode: Bool { !searchText.isEmpty }

    var body: some View {
        NavigationStack {
            Group {
                if isInSearchMode {
                    searchResultsView
                } else if isLoading && posts.isEmpty {
                    ProgressView("Loading posts...")
                } else if let errorMessage, posts.isEmpty {
                    ContentUnavailableView {
                        Label("Failed to Load", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("Retry") { Task { await loadPosts() } }
                    }
                } else {
                    postListView
                }
            }
            .navigationTitle("Forum")
            .searchable(text: $searchText, prompt: "Search posts")
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
                            ForEach(ForumOrdering.allCases) { option in
                                Text(option.label).tag(option)
                            }
                        }
                    } label: {
                        Label("Sort", systemImage: "arrow.up.arrow.down")
                    }
                }
            }
            .onChange(of: ordering) { _, _ in
                Task { await loadPosts() }
            }
            .task { await loadPosts() }
            .navigationDestination(for: ForumPost.self) { post in
                ForumPostView(post: post)
            }
        }
    }

    // MARK: - Post List

    private var postListView: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(posts) { post in
                    postPreviewButton(post)
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

    // MARK: - Search Results

    private var searchResultsView: some View {
        Group {
            if isSearching {
                ProgressView("Searching...")
            } else if searchResults.isEmpty {
                ContentUnavailableView.search(text: searchText)
            } else {
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(searchResults) { post in
                            postPreviewButton(post)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                }
            }
        }
    }

    // MARK: - Data Loading

    private func postPreviewButton(_ post: ForumPost) -> some View {
        NavigationLink(value: post) {
            ForumPostPreviewCard(post: post)
        }
        .buttonStyle(.plain)
    }

    private func loadPosts() async {
        isLoading = true
        errorMessage = nil
        do {
            var params: [String: String] = [
                "page": "1",
                "page_size": "12"
            ]
            if let value = ordering.apiValue {
                params["ordering"] = value
            }
            let response: PaginatedResponse<ForumPost> = try await APIService.shared.get(
                "/forum/posts/",
                queryItems: params
            )
            posts = response.results
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
            var params: [String: String] = [
                "page": "\(nextPage)",
                "page_size": "12"
            ]
            if let value = ordering.apiValue {
                params["ordering"] = value
            }
            let response: PaginatedResponse<ForumPost> = try await APIService.shared.get(
                "/forum/posts/",
                queryItems: params
            )
            posts.append(contentsOf: response.results)
            hasMore = response.next != nil
            currentPage = nextPage
        } catch {}
        isLoading = false
    }

    private func performSearch(query: String) async {
        isSearching = true
        do {
            let response: PaginatedResponse<ForumPost> = try await APIService.shared.get(
                "/forum/posts/",
                queryItems: ["search": query, "page_size": "20"]
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

// MARK: - Sort Options

enum ForumOrdering: String, CaseIterable, Identifiable {
    case defaultOrder
    case newest
    case updated
    case likes
    case comments

    var id: String { rawValue }

    var label: String {
        switch self {
        case .defaultOrder: "Default"
        case .newest: "Newest"
        case .updated: "Recently Updated"
        case .likes: "Most Liked"
        case .comments: "Most Commented"
        }
    }

    var apiValue: String? {
        switch self {
        case .defaultOrder: nil
        case .newest: "-created_at"
        case .updated: "-updated_at"
        case .likes: "-likes_count"
        case .comments: "-comments_count"
        }
    }
}

#Preview {
    ForumView()
}
