import SwiftUI

struct ForumPostCommentCard: View {
    let comment: ForumPostComment
    let replyToDisplayName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                commentAvatar
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(commentDisplayName)
                            .font(.subheadline.weight(.medium))
                        if let targetName = replyToDisplayName {
                            Image(systemName: "arrowshape.turn.up.left.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(.tertiary)
                            Text(targetName)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Text(formattedDate)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if comment.likesCount > 0 {
                    Label("\(comment.likesCount)", systemImage: "hand.thumbsup")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Text(strippedContent)
                .font(.subheadline)
                .foregroundStyle(.primary.opacity(0.85))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(.gray.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var commentAvatar: some View {
        Group {
            if !comment.isAnonymous, let author = comment.author, let urlStr = author.avatar,
               let url = URL(string: urlStr) {
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
        .frame(width: 28, height: 28)
        .clipShape(Circle())
    }

    private var initialsCircle: some View {
        let initial = comment.isAnonymous ? "?" : String((comment.author?.name ?? "?").prefix(1)).uppercased()
        return Circle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Text(initial)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }

    private var commentDisplayName: String {
        comment.isAnonymous ? "Anonymous" : (comment.author?.name ?? "Anonymous")
    }

    private var strippedContent: String {
        comment.content
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: comment.createdAt) else { return comment.createdAt }
        let display = RelativeDateTimeFormatter()
        display.unitsStyle = .short
        return display.localizedString(for: date, relativeTo: .now)
    }
}
