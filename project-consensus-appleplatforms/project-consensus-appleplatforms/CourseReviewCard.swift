import SwiftUI

struct CourseReviewCard: View {
    let review: CourseReview

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            authorAndRating

            if let attrs = review.attributes {
                attributesGrid(attrs)
            }

            Text(strippedContent)
                .font(.subheadline)
                .foregroundStyle(.primary.opacity(0.85))
                .lineLimit(4)
                .frame(maxWidth: .infinity, alignment: .leading)

            if review.likesCount > 0 || review.repliesCount > 0 || review.term != nil {
                HStack(spacing: 16) {
                    if review.likesCount > 0 {
                        Label("\(review.likesCount)", systemImage: "hand.thumbsup")
                    }
                    if review.repliesCount > 0 {
                        Label("\(review.repliesCount)", systemImage: "bubble.left")
                    }
                    Spacer()
                    if let term = review.term {
                        termBadge(term)
                    }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(.gray.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Author & Rating

    private var authorAndRating: some View {
        HStack(alignment: .top) {
            HStack(spacing: 8) {
                authorAvatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(displayName)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text(formattedDate)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Spacer()
            ratingBadge
        }
    }

    private var authorAvatar: some View {
        Group {
            if let author = review.author, let urlStr = author.avatarUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsCircle(for: review.author?.name ?? "?")
                    }
                }
            } else {
                initialsCircle(for: review.isAnonymous ? "?" : (review.author?.name ?? "?"))
            }
        }
        .frame(width: 32, height: 32)
        .clipShape(Circle())
    }

    private var ratingBadge: some View {
        HStack(spacing: 4) {
            starsView(rating: review.overallRating)
            Text(String(format: "%.1f", review.overallRating))
                .font(.subheadline.weight(.bold).monospacedDigit())
        }
    }

    private func starsView(rating: Double) -> some View {
        let score5 = rating / 2.0
        return HStack(spacing: 1) {
            ForEach(0..<5, id: \.self) { i in
                Image(systemName: starName(index: i, score: score5))
                    .font(.system(size: 10))
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

    // MARK: - Attributes

    private func attributesGrid(_ attrs: CourseReviewAttributes) -> some View {
        HStack(spacing: 8) {
            if let v = attrs.difficulty { attributeChip("Difficulty", v) }
            if let v = attrs.workload { attributeChip("Workload", v) }
            if let v = attrs.grading { attributeChip("Grading", v) }
            if let v = attrs.gain { attributeChip("Gain", v) }
        }
    }

    private func termBadge(_ term: CourseReviewTerm) -> some View {
        Text(term.displayText)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(.tint.opacity(0.1), in: Capsule())
            .foregroundStyle(.tint)
    }

    private func attributeChip(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.secondary)
            Text(value.capitalized)
                .font(.system(size: 10, weight: .semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(.gray.opacity(0.1), in: Capsule())
        }
    }

    // MARK: - Helpers

    private var displayName: String {
        if review.isAnonymous { return "Anonymous" }
        return review.author?.name ?? "Anonymous"
    }

    private var strippedContent: String {
        review.content
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

    private func initialsCircle(for name: String) -> some View {
        Circle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Text(String(name.prefix(1)).uppercased())
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }
}
