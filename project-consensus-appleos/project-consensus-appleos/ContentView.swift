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
            LatestCourseReviewsView()
                .tabItem {
                    Label("Reviews", systemImage: "star.bubble")
                }
            
            ForumView()
                .tabItem {
                    Label("Forum", systemImage: "bubble.left.and.bubble.right")
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
