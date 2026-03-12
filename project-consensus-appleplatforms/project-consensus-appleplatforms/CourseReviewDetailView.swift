import SwiftUI

struct CourseReviewDetailView: View {
    let review: CourseReview

    @State private var replies: [CourseReviewReply] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                fullReviewSection
                Divider()
                repliesSection
            }
            .padding()
        }
        .navigationTitle("Review")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") { dismiss() }
            }
        }
        .task { await loadReplies() }
    }

    // MARK: - Full Review

    private var fullReviewSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                authorAvatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(displayName)
                        .font(.headline)
                    HStack(spacing: 6) {
                        Text(formattedDate)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let term = review.term {
                            Text(term.displayText)
                                .font(.caption.weight(.medium))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(.tint.opacity(0.1), in: Capsule())
                                .foregroundStyle(.tint)
                        }
                    }
                }
                Spacer()
            }

            ratingRow

            if let attrs = review.attributes {
                attributesRow(attrs)
            }

            Text(strippedContent)
                .font(.body)
                .foregroundStyle(.primary.opacity(0.9))
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 20) {
                Label("\(review.likesCount)", systemImage: review.isLiked ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .foregroundStyle(review.isLiked ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                Label("\(review.repliesCount)", systemImage: "bubble.left")
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .font(.subheadline)
        }
    }

    private var ratingRow: some View {
        HStack(spacing: 6) {
            starsView(rating: review.overallRating)
            Text(String(format: "%.1f", review.overallRating))
                .font(.title3.weight(.bold).monospacedDigit())
            Text("/ 10")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private func attributesRow(_ attrs: CourseReviewAttributes) -> some View {
        HStack(spacing: 8) {
            if let v = attrs.difficulty { attributePill("Difficulty", v) }
            if let v = attrs.workload { attributePill("Workload", v) }
            if let v = attrs.grading { attributePill("Grading", v) }
            if let v = attrs.gain { attributePill("Gain", v) }
        }
    }

    private func attributePill(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.secondary)
            Text(value.capitalized)
                .font(.system(size: 11, weight: .semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(.gray.opacity(0.1), in: Capsule())
        }
    }

    // MARK: - Replies Section

    private var repliesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Comments (\(review.repliesCount))", systemImage: "bubble.left.and.bubble.right")
                .font(.headline)

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 60)
            } else if let error = errorMessage {
                VStack(spacing: 8) {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Retry") { Task { await loadReplies() } }
                        .font(.subheadline)
                }
            } else if replies.isEmpty {
                Text("No comments yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 40)
            } else {
                VStack(spacing: 12) {
                    ForEach(replies) { reply in
                        replyCard(reply)
                    }
                }
            }
        }
    }

    private func replyCard(_ reply: CourseReviewReply) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                replyAvatar(reply)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(replyDisplayName(reply))
                            .font(.subheadline.weight(.medium))
                        if let targetName = replyToName(reply) {
                            Text("replies to")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                            Text(targetName)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Text(replyFormattedDate(reply))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if reply.likes > 0 {
                    Label("\(reply.likes)", systemImage: "hand.thumbsup")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Text(strippedHTML(reply.content))
                .font(.subheadline)
                .foregroundStyle(.primary.opacity(0.85))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(.gray.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func replyAvatar(_ reply: CourseReviewReply) -> some View {
        Group {
            if !reply.isAnonymous, let author = reply.author, let urlStr = author.avatarUrl,
               let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        replyInitials(reply)
                    }
                }
            } else {
                replyInitials(reply)
            }
        }
        .frame(width: 28, height: 28)
        .clipShape(Circle())
    }

    private func replyInitials(_ reply: CourseReviewReply) -> some View {
        let initial = reply.isAnonymous ? "?" : String((reply.author?.name ?? "?").prefix(1)).uppercased()
        return Circle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Text(initial)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }

    private func replyDisplayName(_ reply: CourseReviewReply) -> String {
        reply.isAnonymous ? "Anonymous" : (reply.author?.name ?? "Anonymous")
    }

    private func replyToName(_ reply: CourseReviewReply) -> String? {
        guard let targetId = reply.replyTo else { return nil }
        if let target = replies.first(where: { $0.id == targetId }) {
            return target.isAnonymous ? "Anonymous" : (target.author?.name ?? "Anonymous")
        }
        return nil
    }

    private func replyFormattedDate(_ reply: CourseReviewReply) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: reply.createdAt) else { return reply.createdAt }
        let display = RelativeDateTimeFormatter()
        display.unitsStyle = .short
        return display.localizedString(for: date, relativeTo: .now)
    }

    // MARK: - Shared Helpers

    private var authorAvatar: some View {
        Group {
            if let author = review.author, let urlStr = author.avatarUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        mainInitialsCircle
                    }
                }
            } else {
                mainInitialsCircle
            }
        }
        .frame(width: 40, height: 40)
        .clipShape(Circle())
    }

    private var mainInitialsCircle: some View {
        let initial = review.isAnonymous ? "?" : String((review.author?.name ?? "?").prefix(1)).uppercased()
        return Circle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Text(initial)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }

    private var displayName: String {
        review.isAnonymous ? "Anonymous" : (review.author?.name ?? "Anonymous")
    }

    private var strippedContent: String {
        strippedHTML(review.content)
    }

    private func strippedHTML(_ html: String) -> String {
        html
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var formattedDate: String {
        let src = review.isEdited ? review.updatedAt : review.createdAt
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: src) else { return src }
        let display = DateFormatter()
        display.dateStyle = .medium
        display.timeStyle = .short
        return (review.isEdited ? "Edited " : "") + display.string(from: date)
    }

    private func starsView(rating: Double) -> some View {
        let score5 = rating / 2.0
        return HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { i in
                Image(systemName: starName(index: i, score: score5))
                    .font(.system(size: 14))
                    .foregroundStyle(.orange)
            }
        }
    }

    private func starName(index: Int, score: Double) -> String {
        let diff = score - Double(index)
        if diff >= 0.75 { return "star.fill" }
        if diff >= 0.25 { return "star.leadinghalf.filled" }
        return "star"
    }

    // MARK: - Data Loading

    private func loadReplies() async {
        guard review.repliesCount > 0 else {
            isLoading = false
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            let response: PaginatedResponse<CourseReviewReply> = try await APIService.shared.get(
                "/replies/",
                queryItems: ["review": review.id]
            )
            replies = response.results.filter { !$0.isDeleted }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
