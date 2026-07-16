import SwiftUI

struct ForumPostView: View {
    let post: ForumPost

    @State private var comments: [ForumPostComment] = []
    @State private var isLoadingComments = true
    @State private var commentsError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                authorRow
                titleSection
                contentSection
                if !post.tags.isEmpty {
                    tagsSection
                }
                statsRow
                Divider()
                commentsSection
            }
            .padding()
        }
        .navigationTitle("Post")
        .toolbarTitleDisplayMode(.inline)
        .task { await loadComments() }
    }

    // MARK: - Title

    private var titleSection: some View {
        Text(post.title)
            .font(.title2.weight(.bold))
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Author

    private var authorRow: some View {
        HStack(spacing: 10) {
            authorAvatar
            VStack(alignment: .leading, spacing: 2) {
                Text(displayName)
                    .font(.subheadline.weight(.medium))
                Text(formattedDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if post.isEdited {
                Text("Edited")
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.secondary.opacity(0.12), in: Capsule())
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var authorAvatar: some View {
        Group {
            if !post.isAnonymous, let urlStr = post.author.avatar, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsCircle
                    }
                }
            } else {
                initialsCircle
            }
        }
        .frame(width: 40, height: 40)
        .clipShape(Circle())
    }

    private var initialsCircle: some View {
        Circle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Text(post.isAnonymous ? "?" : String(post.author.name.prefix(1)).uppercased())
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }

    private var displayName: String {
        post.isAnonymous ? "Anonymous" : post.author.name
    }

    // MARK: - Content

    private var contentSection: some View {
        Text(strippedContent)
            .font(.body)
            .foregroundStyle(.primary.opacity(0.9))
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var strippedContent: String {
        strippedHTML(post.content)
    }

    // MARK: - Tags

    private var tagsSection: some View {
        FlowLayout(spacing: 8) {
            ForEach(post.tags, id: \.self) { tag in
                Text("#\(tag)")
                    .font(.system(size: 12, weight: .medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(.tint.opacity(0.1), in: Capsule())
                    .foregroundStyle(.tint)
            }
        }
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: 20) {
            Label("\(post.likesCount)", systemImage: post.isLiked ? "heart.fill" : "heart")
                .foregroundStyle(post.isLiked ? AnyShapeStyle(.red) : AnyShapeStyle(.secondary))
            Label("\(post.commentsCount)", systemImage: "bubble.left")
                .foregroundStyle(.secondary)
            Spacer()
        }
        .font(.subheadline)
    }

    // MARK: - Comments

    private var commentsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Comments (\(post.commentsCount))", systemImage: "bubble.left.and.bubble.right")
                .font(.headline)

            if isLoadingComments {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 60)
            } else if let error = commentsError {
                VStack(spacing: 8) {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Retry") { Task { await loadComments() } }
                        .font(.subheadline)
                }
            } else if comments.isEmpty {
                Text("No comments yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 40)
            } else {
                VStack(spacing: 12) {
                    ForEach(comments) { comment in
                        ForumPostCommentCard(
                            comment: comment,
                            replyToDisplayName: replyToName(comment)
                        )
                    }
                }
            }
        }
    }

    private func replyToName(_ comment: ForumPostComment) -> String? {
        guard let targetId = comment.replyTo else { return nil }
        if let target = comments.first(where: { $0.id == targetId }) {
            return target.isAnonymous ? "Anonymous" : (target.author?.name ?? "Anonymous")
        }
        return nil
    }

    // MARK: - HTML Stripping

    private func strippedHTML(_ html: String) -> String {
        html
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Data Loading

    private func loadComments() async {
        guard post.commentsCount > 0 else {
            isLoadingComments = false
            return
        }
        isLoadingComments = true
        commentsError = nil
        do {
            let response: PaginatedResponse<ForumPostComment> = try await APIService.shared.get(
                "/forum/comments/",
                queryItems: ["postId": post.id, "page_size": "50"]
            )
            comments = response.results.filter { !$0.isDeleted }
        } catch {
            commentsError = error.localizedDescription
        }
        isLoadingComments = false
    }

    // MARK: - Date Formatting

    private var formattedDate: String {
        let src = post.isEdited ? post.updatedAt : post.createdAt
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: src) else { return src }
        let display = DateFormatter()
        display.dateStyle = .medium
        display.timeStyle = .short
        return display.string(from: date)
    }
}

// MARK: - Flow Layout

/// A simple wrapping horizontal layout for tags.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        var height: CGFloat = 0
        for (i, row) in rows.enumerated() {
            let rowHeight = row.map { $0.sizeThatFits(.unspecified).height }.max() ?? 0
            height += rowHeight
            if i < rows.count - 1 { height += spacing }
        }
        return CGSize(width: proposal.width ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        var y = bounds.minY
        for row in rows {
            let rowHeight = row.map { $0.sizeThatFits(.unspecified).height }.max() ?? 0
            var x = bounds.minX
            for subview in row {
                let size = subview.sizeThatFits(.unspecified)
                subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += rowHeight + spacing
        }
    }

    private func computeRows(proposal: ProposedViewSize, subviews: Subviews) -> [[LayoutSubviews.Element]] {
        let maxWidth = proposal.width ?? .infinity
        var rows: [[LayoutSubviews.Element]] = [[]]
        var currentWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentWidth + size.width > maxWidth, !rows[rows.count - 1].isEmpty {
                rows.append([])
                currentWidth = 0
            }
            rows[rows.count - 1].append(subview)
            currentWidth += size.width + spacing
        }
        return rows
    }
}

#Preview {
    NavigationStack {
        ForumPostView(post: ForumPost(
            id: "1",
            title: "Sample Post Title",
            content: "This is some sample content for the forum post preview.",
            author: ForumPostAuthor(id: "u1", name: "John Doe", avatar: nil),
            createdAt: "2025-03-10T12:00:00.000000Z",
            updatedAt: "2025-03-10T12:00:00.000000Z",
            tags: ["general", "help"],
            likesCount: 5,
            commentsCount: 3,
            isLiked: false,
            isAnonymous: false,
            isEdited: false
        ))
    }
}
