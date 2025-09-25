import { ForumPostComment } from '@/types/forum';

/**
 * 示例评论数据 - 扁平化两级结构
 * 主评论：直接回复帖子
 * 子评论：回复主评论或其他子评论，通过replyToUser记录回复的是谁
 */
export const sampleComments: ForumPostComment[] = [
  // 主评论
  {
    id: 'comment-1',
    content: '好問題！我來分享下我嘅理解：\n\n<strong>接口（Interface）</strong>：\n<ul>\n<li>可以實現多個接口（多重繼承）</li>\n<li>只定義方法簽名，冇具體實現</li>\n<li>適合定義「契約」或「能力」</li>\n</ul>\n\n<strong>抽象類（Abstract Class）</strong>：\n<ul>\n<li>只能繼承一個抽象類</li>\n<li>可以有具體方法實現</li>\n<li>適合提供共同嘅基礎功能</li>\n</ul>\n\n例如：<code>Animal</code>抽象類提供<code>eat()</code>嘅通用實現，而<code>Flyable</code>接口定義<code>fly()</code>嘅能力。',
    author: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    },
    createdAt: '2024-01-15T10:30:00Z',
    likes: 12,
    isLiked: false,
    postId: 'a7f3b2c1'
  },
  {
    id: 'comment-2',
    content: '我補充下「部分實現」嘅概念：\n\n抽象類可以包含：\n<ul>\n<li><strong>抽象方法</strong>：只有聲明，冇實現（子類必須實現）</li>\n<li><strong>具體方法</strong>：已經有實現嘅方法</li>\n<li><strong>成員變量</strong>：可以有狀態</li>\n</ul>\n\n例如：\n<pre><code class="language-java">abstract class Vehicle {\n    protected String brand; // 具體變量\n    \n    public void start() { // 具體方法\n        System.out.println("Starting...");\n    }\n    \n    public abstract void accelerate(); // 抽象方法\n}</code></pre>\n\n呢樣子類就可以繼承<code>start()</code>方法，但必須自己實現<code>accelerate()</code>。',
    author: {
      id: 'user-5',
      name: 'David Chen',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david'
    },
    createdAt: '2024-01-15T16:45:00Z',
    likes: 7,
    isLiked: false,
    postId: 'a7f3b2c1'
  },
  {
    id: 'comment-3',
    content: '關於多重繼承嘅問題：\n\n<strong>Java唔支援類嘅多重繼承</strong>，但係可以實現多個接口！\n\n例如：\n<pre><code class="language-java">class Bird extends Animal implements Flyable, Swimmable {\n    // 可以同時實現多個接口\n    public void fly() { /* 實現飛翔 */ }\n    public void swim() { /* 實現游泳 */ }\n}</code></pre>\n\n<strong>點解要咁設計？</strong>\n<ul>\n<li>避免「鑽石問題」（Diamond Problem）</li>\n<li>接口更輕量，冇狀態衝突</li>\n<li>更靈活嘅組合</li>\n</ul>\n\n所以如果你需要多個「能力」，用接口就啱啦！',
    author: {
      id: 'user-6',
      name: 'Sarah Wilson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah'
    },
    createdAt: '2024-01-16T09:20:00Z',
    likes: 15,
    isLiked: true,
    postId: 'a7f3b2c1'
  },
  {
    id: 'comment-4',
    content: '實際項目中嘅選擇策略：\n\n<strong>用抽象類嘅情況：</strong>\n<ul>\n<li>有共同嘅狀態（成員變量）</li>\n<li>有部分通用嘅實現</li>\n<li>子類之間有「is-a」關係</li>\n</ul>\n\n<strong>用接口嘅情況：</strong>\n<ul>\n<li>定義行為契約</li>\n<li>需要多重繼承</li>\n<li>不同類別需要相同能力</li>\n</ul>\n\n<strong>實際例子：</strong>\n<pre><code class="language-java">// 抽象類：有共同狀態\nabstract class DatabaseConnection {\n    protected String url;\n    public abstract void connect();\n}\n\n// 接口：定義能力\ninterface Serializable {\n    String toJson();\n}</code></pre>\n\n通常：<strong>抽象類用於繼承，接口用於能力</strong>！',
    author: {
      id: 'user-8',
      name: 'Michael Lee',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=michael'
    },
    createdAt: '2024-01-16T14:30:00Z',
    likes: 9,
    isLiked: false,
    postId: 'a7f3b2c1'
  },
  // 子评论
  {
    id: 'comment-1-1',
    content: '完全同意！你嘅例子好清楚。我再補充一個實際應用：\n\n<strong>Spring框架中嘅例子：</strong>\n<pre><code class="language-java">// 抽象類：提供通用功能\nabstract class AbstractController {\n    protected Logger logger; // 共同狀態\n    \n    public void logRequest() { // 具體實現\n        logger.info("Request received");\n    }\n    \n    public abstract void handleRequest(); // 抽象方法\n}\n\n// 接口：定義能力\ninterface Cacheable {\n    void cache();\n    void evict();\n}</code></pre>\n\n呢樣設計可以同時繼承通用功能同實現緩存能力！',
    author: {
      id: 'user-3',
      name: 'Emma Davis',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma'
    },
    createdAt: '2024-01-15T11:15:00Z',
    likes: 5,
    isLiked: true,
    parentId: 'comment-1',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    }
  },
  {
    id: 'comment-1-2',
    content: '我想問下，如果一個類需要同時有狀態同多個能力，應該點樣設計？\n\n例如：\n<pre><code class="language-java">class User {\n    private String name; // 狀態\n    \n    // 需要多個能力：可序列化、可比較、可克隆\n    // 應該用抽象類定係接口？\n}</code></pre>\n\n呢種情況下點樣平衡設計？',
    author: {
      id: 'user-4',
      name: 'James Wong',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=james'
    },
    createdAt: '2024-01-15T14:20:00Z',
    likes: 3,
    isLiked: false,
    parentId: 'comment-1',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    }
  },
  {
    id: 'comment-1-2-1',
    content: '好問題！呢種情況下建議用<strong>組合設計</strong>：\n\n<pre><code class="language-java">class User implements Serializable, Comparable<User>, Cloneable {\n    private String name;\n    \n    // 實現接口方法\n    public String toJson() { /* 序列化 */ }\n    public int compareTo(User other) { /* 比較 */ }\n    public User clone() { /* 克隆 */ }\n}</code></pre>\n\n<strong>設計原則：</strong>\n<ul>\n<li>狀態用普通類</li>\n<li>能力用接口</li>\n<li>避免用抽象類做「能力容器」</li>\n</ul>\n\n<strong>原因：</strong>\n<ul>\n<li>接口更靈活，可以隨時添加新能力</li>\n<li>避免繼承層次過深</li>\n<li>符合「組合優於繼承」原則</li>\n</ul>',
    author: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    },
    createdAt: '2024-01-15T15:30:00Z',
    likes: 8,
    isLiked: false,
    parentId: 'comment-1-2',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-4',
      name: 'James Wong',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=james'
    }
  },
  {
    id: 'comment-3-1',
    content: '完全同意！多重繼承確實係Java設計嘅核心概念。我再補充一個重要點：\n\n<strong>Java 8之後嘅接口進化：</strong>\n<pre><code class="language-java">interface Flyable {\n    void fly(); // 抽象方法\n    \n    // 默認方法（Java 8+）\n    default void land() {\n        System.out.println("Landing...");\n    }\n    \n    // 靜態方法（Java 8+）\n    static void showInfo() {\n        System.out.println("This is a flyable object");\n    }\n}</code></pre>\n\n<strong>新特性嘅影響：</strong>\n<ul>\n<li>接口可以有實現（默認方法）</li>\n<li>但依然唔可以有狀態</li>\n<li>提供咗更靈活嘅設計選擇</li>\n</ul>\n\n呢樣接口同抽象類嘅界限變得模糊咗，但核心原則依然適用！',
    author: {
      id: 'user-7',
      name: 'Jennifer Liu',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jennifer'
    },
    createdAt: '2024-01-16T10:15:00Z',
    likes: 4,
    isLiked: false,
    parentId: 'comment-3',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-6',
      name: 'Sarah Wilson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah'
    }
  },
  // 添加更多子评论来测试分页功能
  {
    id: 'comment-1-3',
    content: '多謝分享！我想問下，<strong>默認方法</strong>同<strong>抽象類嘅具體方法</strong>有咩區別？',
    author: {
      id: 'user-9',
      name: 'Tom Wilson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tom'
    },
    createdAt: '2024-01-16T11:30:00Z',
    likes: 2,
    isLiked: false,
    parentId: 'comment-1',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    }
  },
  {
    id: 'comment-1-4',
    content: '好問題！主要區別係：\n\n<strong>默認方法：</strong>\n<ul>\n<li>可以被子類重寫</li>\n<li>不能訪問實例變量</li>\n<li>主要用於向接口添加新功能</li>\n</ul>\n\n<strong>抽象類具體方法：</strong>\n<ul>\n<li>可以訪問實例變量</li>\n<li>提供真正的共享實現</li>\n<li>用於定義共同行為</li>\n</ul>',
    author: {
      id: 'user-10',
      name: 'Lisa Chen',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisa'
    },
    createdAt: '2024-01-16T12:00:00Z',
    likes: 6,
    isLiked: true,
    parentId: 'comment-1',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    }
  },
  {
    id: 'comment-1-5',
    content: '補充一下，<code>default</code>方法主要係為咗<strong>向後兼容</strong>。當你向現有接口添加新方法時，唔會破壞已經實現咗呢個接口嘅類。',
    author: {
      id: 'user-11',
      name: 'Kevin Zhang',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kevin'
    },
    createdAt: '2024-01-16T12:30:00Z',
    likes: 3,
    isLiked: false,
    parentId: 'comment-1',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    }
  },
  {
    id: 'comment-1-6',
    content: '完全正確！呢個係Java 8引入默認方法嘅主要原因。之前如果要向接口添加方法，所有實現類都要修改，而家就可以用默認方法提供默認實現。',
    author: {
      id: 'user-12',
      name: 'Amy Wang',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amy'
    },
    createdAt: '2024-01-16T13:00:00Z',
    likes: 1,
    isLiked: false,
    parentId: 'comment-1',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    }
  },
  {
    id: 'comment-1-7',
    content: '我想問下，如果一個類實現咗多個接口，而呢啲接口有相同嘅默認方法，會點樣處理？',
    author: {
      id: 'user-13',
      name: 'Bob Lee',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob'
    },
    createdAt: '2024-01-16T13:30:00Z',
    likes: 4,
    isLiked: false,
    parentId: 'comment-1',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    }
  },
  {
    id: 'comment-1-8',
    content: '呢個係<strong>鑽石問題</strong>嘅變種！如果兩個接口有相同嘅默認方法，實現類必須<strong>重寫</strong>呢個方法，否則會編譯錯誤。\n\n<pre><code class="language-java">interface A {\n    default void method() { System.out.println("A"); }\n}\n\ninterface B {\n    default void method() { System.out.println("B"); }\n}\n\nclass C implements A, B {\n    // 必須重寫，否則編譯錯誤\n    public void method() {\n        System.out.println("C");\n    }\n}</code></pre>',
    author: {
      id: 'user-14',
      name: 'Grace Liu',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=grace'
    },
    createdAt: '2024-01-16T14:00:00Z',
    likes: 8,
    isLiked: true,
    parentId: 'comment-1',
    postId: 'a7f3b2c1',
    replyToUser: {
      id: 'user-2',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'
    }
  }
];

// Extend sample comments to test pagination (generate many main comments for post a7f3b2c1)
for (let i = 1; i <= 40; i++) {
  const id = `bulk-main-${i}`;
  sampleComments.push({
    id,
    content: `This is a generated main comment #${i} for demo pagination. Keep scrolling to load more.`,
    author: {
      id: `bulk-user-${(i % 10) + 1}`,
      name: `BulkUser${(i % 10) + 1}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=bulk${i}`
    },
    createdAt: new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString(),
    likes: (i * 7) % 29,
    isLiked: false,
    postId: 'a7f3b2c1'
  });
}

/**
 * 根据帖子ID获取评论列表 / Get comments by post ID
 */
export function getCommentsByPostId(postId: string): ForumPostComment[] {
  return sampleComments.filter(comment => comment.postId === postId);
}

/**
 * 分离主评论和子评论 / Separate main comments and sub-comments
 * 将扁平化的评论数据分离为主评论和子评论两个数组
 */
export function separateComments(comments: ForumPostComment[]): {
  mainComments: ForumPostComment[];
  subComments: ForumPostComment[];
} {
  const mainComments: ForumPostComment[] = [];
  const subComments: ForumPostComment[] = [];

  comments.forEach(comment => {
    if (!comment.parentId) {
      mainComments.push(comment);
    } else {
      subComments.push(comment);
    }
  });

  // 按创建时间排序 - 创建新数组而不是修改原数组
  const sortedMainComments = [...mainComments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const sortedSubComments = [...subComments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return { mainComments: sortedMainComments, subComments: sortedSubComments };
}

/**
 * 根据主评论ID获取其子评论 / Get sub-comments by main comment ID
 */
export function getSubCommentsByMainCommentId(mainCommentId: string, subComments: ForumPostComment[]): ForumPostComment[] {
  return subComments.filter(comment =>
    comment.parentId === mainCommentId
  );
}

/**
 * 获取帖子的评论数据（分离后的结构）/ Get separated comments for a post
 */
export function getSeparatedCommentsByPostId(postId: string): {
  mainComments: ForumPostComment[];
  subComments: ForumPostComment[];
} {
  const comments = getCommentsByPostId(postId);
  return separateComments(comments);
}

/**
 * 切换评论点赞状态 / Toggle comment like status
 */
export function toggleCommentLike(commentId: string): ForumPostComment | null {
  const commentIndex = sampleComments.findIndex(c => c.id === commentId);
  if (commentIndex === -1) return null;
  
  const comment = sampleComments[commentIndex];
  comment.isLiked = !comment.isLiked;
  comment.likes = comment.likes + (comment.isLiked ? 1 : -1);
  
  return comment;
}

/**
 * 删除评论 / Delete comment
 */
export function deleteComment(commentId: string): boolean {
  const commentIndex = sampleComments.findIndex(c => c.id === commentId);
  if (commentIndex === -1) return false;
  
  sampleComments.splice(commentIndex, 1);
  return true;
}

/**
 * 添加新评论 / Add new comment
 */
export function addComment(comment: ForumPostComment): ForumPostComment {
  sampleComments.push(comment);
  return comment;
}
