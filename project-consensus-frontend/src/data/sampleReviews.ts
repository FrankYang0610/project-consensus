/**
 * 示例课程评价数据 / Sample course review data
 */

import type { CourseReview } from '@/types';

export const sampleReviews: CourseReview[] = [
  {
    id: "review-1",
    subjectId: "crs_0003", // COMP1A12 - Programming Fundamentals (Dr. Kim)
    author: {
      id: "user-001",
      name: "Alice Wong",
      avatarUrl: undefined
    },
    overallRating: 8.5,
    attributes: {
      difficulty: 'hard',
      workload: 'heavy',
      grading: 'balanced',
      gain: 'high'
    },
    content: "这门课程真的很棒！虽然作业量比较大，但是学到了很多实用的编程技巧。Dr. Kim 讲课很清晰，而且会提供很多实际的例子。推荐给想要深入学习编程的同学。\n\n不过要注意的是，这门课的期中考试相对较难，需要提前做好准备。总的来说，收获很大，值得推荐！",
    likesCount: 24,
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-16T14:20:00Z",
    isLiked: true,
    term: {
      year: 2024,
      semester: "fall"
    },
    repliesCount: 8
  },
  {
    id: "review-2",
    subjectId: "crs_0003", // COMP1A12 - Programming Fundamentals (Dr. Kim)
    author: {
      id: "user-002",
      name: "Bob Chen",
      avatarUrl: undefined
    },
    overallRating: 6.0,
    attributes: {
      difficulty: 'veryHard',
      workload: 'veryHeavy',
      grading: 'strict',
      gain: 'decent'
    },
    content: "课程内容很充实，但是真的太难了。我花了很多时间学习，但是还是觉得跟不上进度。老师讲得很快，如果没有编程基础的话会很吃力。\n\n建议大家在选课前先看看课程大纲，确保自己有足够的时间投入。不过话说回来，如果你能坚持下来，确实能学到很多东西。",
    likesCount: 12,
    createdAt: "2024-01-10T16:45:00Z",
    isLiked: false,
    term: {
      year: 2024,
      semester: "fall"
    },
    repliesCount: 3
  },
  {
    id: "review-3",
    subjectId: "crs_0003_ma", // COMP1A12 - Programming Fundamentals (Dr. Ma)
    author: {
      id: "user-003",
      name: "Catherine Liu",
      avatarUrl: undefined
    },
    overallRating: 9.2,
    attributes: {
      difficulty: 'medium',
      workload: 'moderate',
      grading: 'lenient',
      gain: 'high'
    },
    content: "Excellent course! Dr. Ma is very knowledgeable and passionate about the subject. The assignments are well-designed and really help reinforce the concepts taught in class.\n\nI especially liked the final project - it gave us a chance to apply everything we learned in a practical way. Would definitely recommend this course to anyone interested in computer science.",
    likesCount: 31,
    createdAt: "2024-01-08T09:15:00Z",
    isLiked: false,
    term: {
      year: 2024,
      semester: "spring"
    },
    repliesCount: 12
  },
  {
    id: "review-4",
    subjectId: "crs_0001", // APSS1A01 - Introduction to Social Sciences (Prof. Wang Yao Wu)
    author: {
      id: "user-004",
      name: "David Zhang",
      avatarUrl: undefined
    },
    overallRating: 7.8,
    attributes: {
      difficulty: 'easy',
      workload: 'light',
      grading: 'lenient',
      gain: 'decent'
    },
    content: "这门通识课程很有趣，涉及了很多社会科学的基础知识。王教授很友善，上课氛围轻松。作业量不大，适合用来平衡其他比较重的专业课。\n\n虽然不算特别深入，但是作为通识教育课程来说已经很不错了。可以帮助拓宽视野，了解不同的学科领域。",
    likesCount: 18,
    createdAt: "2024-12-20T11:30:00Z",
    isLiked: true,
    term: {
      year: 2024,
      semester: "fall"
    },
    repliesCount: 5
  },
  {
    id: "review-5",
    subjectId: "crs_0002", // APSS2B10 - Social Research Methods (Dr. Lee)
    author: {
      id: "user-005",
      name: "Emma Johnson",
      avatarUrl: undefined
    },
    overallRating: 5.5,
    attributes: {
      difficulty: 'veryHard',
      workload: 'veryHeavy',
      grading: 'strict',
      gain: 'low'
    },
    content: "Honestly, this course was a struggle for me. The pace is very fast and the workload is overwhelming. I felt like I was constantly behind and couldn't fully grasp the concepts before moving on to the next topic.\n\nDr. Lee seems knowledgeable but doesn't explain things in a way that's easy to understand for beginners. Maybe it's better suited for students who already have strong research background.",
    likesCount: 7,
    createdAt: "2024-12-15T20:45:00Z",
    isLiked: false,
    term: {
      year: 2024,
      semester: "fall"
    },
    repliesCount: 15
  },
  {
    id: "review-6",
    subjectId: "crs_0009", // ISE3C20 - Human-Computer Interaction (Prof. Ng)
    author: {
      id: "user-006",
      name: "Frank Li",
      avatarUrl: undefined
    },
    overallRating: 9.5,
    attributes: {
      difficulty: 'easy',
      workload: 'light',
      grading: 'lenient',
      gain: 'high'
    },
    content: "这门课是我上过最好的课程之一！Prof. Ng 真的很棒，讲课生动有趣，而且非常实用。课程设计得很好，从理论到实践都有涉及。\n\n特别喜欢课程项目，可以自己选择感兴趣的方向去做。工作量不大但是收获很多，强烈推荐给所有对UX/UI设计感兴趣的同学！",
    likesCount: 42,
    createdAt: "2024-07-10T14:20:00Z",
    isLiked: true,
    term: {
      year: 2024,
      semester: "summer"
    },
    repliesCount: 18
  }
];

/**
 * 根据课程ID获取评价 / Get reviews by course ID
 */
export function getReviewsBySubjectId(subjectId: string): CourseReview[] {
  return sampleReviews.filter(review => review.subjectId === subjectId);
}

/**
 * 根据评价ID获取单个评价 / Get review by ID
 */
export function getReviewById(reviewId: string): CourseReview | undefined {
  return sampleReviews.find(review => review.id === reviewId);
}
