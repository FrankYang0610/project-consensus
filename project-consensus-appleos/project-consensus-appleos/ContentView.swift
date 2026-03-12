//
//  ContentView.swift
//  project-consensus-appleos
//
//  Created by Frank Xikun Yang on 3/12/26.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            ForumView()
                .tabItem {
                    Label("Forum", systemImage: "bubble.left.and.bubble.right")
                }

            LatestCourseReviewsView()
                .tabItem {
                    Label("Reviews", systemImage: "star.bubble")
                }
            
            CoursesView()
                .tabItem {
                    Label("Courses", systemImage: "book")
                }

            TeachersView()
                .tabItem {
                    Label("Teachers", systemImage: "person.2")
                }
        }
    }
}

#Preview {
    ContentView()
}
