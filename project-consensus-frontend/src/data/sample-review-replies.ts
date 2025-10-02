/**
 * Sample course review replies data (single-layer)
 */

import type { CourseReviewReply } from "@/types";

// In-memory sample dataset for demo purposes
export const sampleReviewReplies: CourseReviewReply[] = [
  // Replies for review-1
  {
    id: "reply-1",
    reviewId: "review-1",
    author: { id: "user-101", name: "George" },
    content: "<p>Agree. The midterm was tough, start revising early.</p>",
    createdAt: "2024-01-16T16:10:00Z",
    likes: 5,
    isLiked: false,
  },
  {
    id: "reply-2",
    reviewId: "review-1",
    author: { id: "user-102", name: "Hannah" },
    replyToUser: { id: "user-101", name: "George" },
    content: "<p>+1, past papers helped me a lot.</p>",
    createdAt: "2024-01-17T08:40:00Z",
    likes: 2,
    isLiked: false,
  },

  // Replies for review-2
  {
    id: "reply-3",
    reviewId: "review-2",
    author: { id: "user-103", name: "Iris" },
    content: "<p>If you’re new to coding, consider the prep workshops.</p>",
    createdAt: "2024-01-11T10:05:00Z",
    likes: 3,
    isLiked: true,
  },

  // Replies for review-3
  {
    id: "reply-4",
    reviewId: "review-3",
    author: { id: "user-104", name: "Jason" },
    content: "<p>Final project demo day was super fun!</p>",
    createdAt: "2024-01-09T13:25:00Z",
    likes: 4,
    isLiked: false,
  },
  {
    id: "reply-5",
    reviewId: "review-3",
    author: { id: "user-105", name: "Kelly" },
    replyToUser: { id: "user-104", name: "Jason" },
    content: "<p>Totally! Loved seeing everyone’s work.</p>",
    createdAt: "2024-01-09T15:00:00Z",
    likes: 1,
    isLiked: false,
  },
];

/**
 * Get replies for a specific course review ID
 */
export function getRepliesByReviewId(reviewId: string): CourseReviewReply[] {
  return sampleReviewReplies.filter(r => r.reviewId === reviewId);
}

