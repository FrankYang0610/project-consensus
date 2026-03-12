import SwiftUI

struct ForumPostPreviewCard: View {
    let post: ForumPost

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            authorRow
            titleAndContent
            if !post.tags.isEmpty {
                tagsRow
            }
            footer
        }
        .padding(16)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
    }

    // MARK: - Author Row

    private var authorRow: some View {
        HStack(spacing: 8) {
            authorAvatar
            VStack(alignment: .leading, spacing: 2) {
                Text(displayName)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.system(size: 9))
                    Text(formattedDate)
                    if post.isEdited {
                        Text("·")
                        Text("edited")
                    }
                }
                .font(.caption2)
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
        .frame(width: 32, height: 32)
        .clipShape(Circle())
    }

    private var initialsCircle: some View {
        Circle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Text(post.isAnonymous ? "?" : String(post.author.name.prefix(1)).uppercased())
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }

    private var displayName: String {
        post.isAnonymous ? "Anonymous" : post.author.name
    }

    // MARK: - Title & Content

    private var titleAndContent: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(post.title)
                .font(.body.weight(.semibold))
                .lineLimit(1)
            Text(truncatedContent)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .frame(minHeight: 36, alignment: .topLeading)
        }
    }

    private var truncatedContent: String {
        let stripped = post.content
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if stripped.count > 150 {
            return String(stripped.prefix(150)) + "..."
        }
        return stripped
    }

    // MARK: - Tags

    private var tagsRow: some View {
        HStack(spacing: 6) {
            ForEach(post.tags, id: \.self) { tag in
                Text("#\(tag)")
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(.secondary.opacity(0.12), in: Capsule())
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: 16) {
            HStack(spacing: 4) {
                Image(systemName: post.isLiked ? "heart.fill" : "heart")
                    .foregroundStyle(post.isLiked ? .red : .secondary)
                Text("\(post.likesCount)")
            }
            HStack(spacing: 4) {
                Image(systemName: "bubble.left")
                Text("\(post.commentsCount)")
            }
            Spacer()
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    // MARK: - Date

    private var formattedDate: String {
        let src = post.isEdited ? post.updatedAt : post.createdAt
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: src) else { return src }
        let display = RelativeDateTimeFormatter()
        display.unitsStyle = .short
        return display.localizedString(for: date, relativeTo: .now)
    }
}
