import SwiftUI

struct CourseReviewPreviewCard: View {
    let review: CourseReview

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            courseHeader
            Divider()
            VStack(alignment: .leading, spacing: 12) {
                authorAndRating
                if let attrs = review.attributes {
                    attributesGrid(attrs)
                }
                contentSection
            }
            .padding(16)
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
    }

    // MARK: - Course Header

    private var courseHeader: some View {
        HStack(spacing: 8) {
            Image(systemName: "book.fill")
                .font(.caption)
                .foregroundStyle(.white)
                .frame(width: 26, height: 26)
                .background(.tint, in: RoundedRectangle(cornerRadius: 6, style: .continuous))

            VStack(alignment: .leading, spacing: 1) {
                Text(review.courseSubjectCode)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tint)
                Text(review.courseTitle.localizedCapitalized)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if let term = review.term {
                termBadge(term)
            }
        }
        .padding(12)
    }

    // MARK: - Author & Rating

    private var authorAndRating: some View {
        HStack {
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

    private func initialsCircle(for name: String) -> some View {
        Circle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Text(String(name.prefix(1)).uppercased())
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
    }

    private var displayName: String {
        if review.isAnonymous { return "Anonymous" }
        return review.author?.name ?? "Anonymous"
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

    // MARK: - Content

    private var contentSection: some View {
        HStack(alignment: .top) {
            Text(strippedContent)
                .font(.subheadline)
                .foregroundStyle(.primary.opacity(0.85))
                .lineLimit(3)
                .frame(maxWidth: .infinity, alignment: .leading)

            if review.likesCount > 0 || review.repliesCount > 0 {
                VStack(spacing: 6) {
                    if review.likesCount > 0 {
                        Label("\(review.likesCount)", systemImage: "hand.thumbsup")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if review.repliesCount > 0 {
                        Label("\(review.repliesCount)", systemImage: "bubble.left")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
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
}
