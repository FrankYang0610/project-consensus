import SwiftUI

struct TeacherDetailsView: View {
    let teacherId: String

    @State private var teacher: Teacher?
    @State private var courses: [TeacherCourseRef] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading...")
            } else if let errorMessage {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(errorMessage)
                }
            } else if let teacher {
                ScrollView {
                    VStack(spacing: 20) {
                        headerCard(teacher)
                        aboutCard(teacher)
                        contactCard(teacher)
                        coursesCard
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 12)
                }
            }
        }
        .navigationTitle(teacher?.name ?? "Teacher")
        .toolbarTitleDisplayMode(.inline)
        .task { await loadData() }
    }

    // MARK: - Header

    private func headerCard(_ teacher: Teacher) -> some View {
        VStack(spacing: 16) {
            TeacherAvatar(teacher: teacher, size: 80)

            VStack(spacing: 4) {
                Text(teacher.name)
                    .font(.title2.weight(.bold))
                    .multilineTextAlignment(.center)
                if !teacher.title.isEmpty || !teacher.department.isEmpty {
                    Text([teacher.title, teacher.department].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }

            HStack(spacing: 32) {
                statItem(
                    value: teacher.rating.overall.map { String(format: "%.1f", $0) } ?? "—",
                    label: "Overall"
                )
                statItem(
                    value: "\(courses.count)",
                    label: "Courses"
                )
                statItem(
                    value: "\(teacher.rating.reviewsCount)",
                    label: "Reviews"
                )
            }
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.weight(.bold).monospacedDigit())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - About

    private func aboutCard(_ teacher: Teacher) -> some View {
        let sections: [(String, String?)] = [
            ("Biography", teacher.biography),
            ("Research Interests", teacher.researchInterests),
            ("Experience", teacher.academicAndProfessionalExperience),
            ("Qualifications", teacher.professionalQualifications),
        ]
        let nonEmpty = sections.filter { $0.1?.isEmpty == false }

        return cardContainer(title: "About", systemImage: "person.text.rectangle") {
            if nonEmpty.isEmpty {
                Text("No bio available.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(nonEmpty, id: \.0) { label, content in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(label)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tint)
                            Text(content!)
                                .font(.subheadline)
                                .foregroundStyle(.primary.opacity(0.85))
                        }
                    }
                }
            }
        }
    }

    // MARK: - Contact

    private func contactCard(_ teacher: Teacher) -> some View {
        let rows: [(String, String, String)] = [
            ("envelope", "Email", teacher.email),
            ("building.2", "Office", teacher.office ?? ""),
            ("clock", "Office Hours", teacher.officeHours ?? ""),
            ("phone", "Phone", teacher.phone ?? ""),
            ("globe", "Homepage", teacher.websiteUrl ?? ""),
            ("link", "Profile", teacher.profileUrl ?? ""),
            ("graduationcap", "Scholars Hub", teacher.scholarsHubUrl ?? ""),
            ("person.3", "Languages", (teacher.languages ?? []).joined(separator: " / ")),
        ]
        let nonEmpty = rows.filter { !$0.2.isEmpty }

        return cardContainer(title: "Contact", systemImage: "envelope") {
            if nonEmpty.isEmpty {
                Text("No contact info available.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 10) {
                    ForEach(nonEmpty, id: \.1) { icon, label, value in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: icon)
                                .font(.caption)
                                .foregroundStyle(.tint)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(label)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if value.hasPrefix("http"), let url = URL(string: value) {
                                    Link(value, destination: url)
                                        .font(.subheadline)
                                        .lineLimit(1)
                                } else {
                                    Text(value)
                                        .font(.subheadline)
                                }
                            }
                            Spacer()
                        }
                    }
                }
            }
        }
    }

    // MARK: - Courses Taught

    private var coursesCard: some View {
        cardContainer(title: "Courses Taught", systemImage: "book") {
            if courses.isEmpty {
                Text("No courses are currently listed.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 10) {
                    ForEach(courses) { course in
                        NavigationLink {
                            TeacherCourseDestinationView(courseId: course.courseId)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(course.subjectCode ?? "")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.tint)
                                    Spacer()
                                    if let terms = course.terms, !terms.isEmpty {
                                        let sorted = terms.sorted { ($0.year, $0.semester) > ($1.year, $1.semester) }
                                        Text(sorted.first!.displayText)
                                            .font(.caption2.weight(.medium))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(.tint.opacity(0.1), in: Capsule())
                                            .foregroundStyle(.tint)
                                    }
                                    Image(systemName: "chevron.right")
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }
                                Text((course.title ?? "").localizedCapitalized)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if let coTeachers = course.coTeachers, !coTeachers.isEmpty {
                                    Text("Co-taught with \(coTeachers.map(\.name).joined(separator: ", "))")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(12)
                            .background(.gray.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Card Container

    private func cardContainer<Content: View>(
        title: String,
        systemImage: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(title, systemImage: systemImage)
                .font(.headline)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
    }

    // MARK: - Data Loading

    private func loadData() async {
        isLoading = true
        do {
            let t: Teacher = try await APIService.shared.get("/teachers/\(teacherId)/")
            let c: [TeacherCourseRef] = try await APIService.shared.get("/teachers/\(teacherId)/courses/")
            teacher = t
            courses = c
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct TeacherCourseDestinationView: View {
    let courseId: String

    @State private var course: Course?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let course {
                CourseDetailView(course: course)
            } else if isLoading {
                ProgressView("Loading course...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView {
                    Label("Course Not Found", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(errorMessage ?? "Unable to load this course.")
                } actions: {
                    Button("Retry") { Task { await loadCourse() } }
                }
            }
        }
        .task(id: courseId) { await loadCourse() }
    }

    private func loadCourse() async {
        if course != nil { return }
        isLoading = true
        errorMessage = nil
        do {
            course = try await APIService.shared.get("/courses/\(courseId)/")
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
