import type { PaginatedResponse } from './common';
import type { Author } from '../user';

export type NotificationType =
  | 'forumPostLiked'
  | 'forumPostCommented'
  | 'forumPostCommentLiked'
  | 'forumPostCommentReplied'
  | 'courseReviewLiked'
  | 'courseReviewReplied'
  | 'courseReviewReplyLiked'
  | 'courseReviewReplyReplied';

export interface NotificationItem {
  id: number;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  actor: Author | null;
  forumPostId?: string | null;
  forumPostCommentId?: string | null;
  courseReviewId?: string | null;
  courseReviewReplyId?: string | null;
  courseId?: string | null;
  contentPreview?: string;
  referencedContentPreview?: string;
}

export interface NotificationsListResponse extends PaginatedResponse<NotificationItem> {}

export interface NotificationSSEEvent {
  type: 'notification';
  unreadCount: number;
}
