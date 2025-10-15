import { ForumPost } from "@/types";

// Sample data - Computer Science course discussions

const initialSamplePosts: ForumPost[] = [
  {
    id: "a7f3b2c1",
    title: "Java編程：接口同抽象類嘅分別",
    content: `
            <h2>點樣揀：<em>接口</em> vs <strong>抽象類</strong>？</h2>
            <p>老師上堂講咗兩者嘅分別，但我都係唔係好明幾時用邊個。我理解嘅係：</p>
            <ul>
                <li><strong>接口（interface）</strong>：定義「能力/協議」</li>
                <li><strong>抽象類（abstract class）</strong>：提供部分實現</li>
            </ul>
            <p>但係我想問：</p>
            <ol>
                <li>如果一個類別需要繼承多個「能力」，係咪一定要用接口？</li>
                <li>抽象類嘅「部分實現」具體係指咩？有冇例子？</li>
                <li>實際項目入面，你哋通常點樣決定用邊個？</li>
            </ol>
            <p>有冇人可以舉個具體嘅例子幫我理解？</p>
        `,
    author: {
      id: "usr_9k2m8x",
      name: "Sarah",
      avatar: undefined  // No avatar, will display default avatar
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    tags: ["Java", "面向對象", "編程基礎"],
    likesCount: 8,
    commentsCount: 3,
    isLiked: true,
  },
  {
    id: "e5d8a9f4",
    title: "设计理论：如何理解色彩搭配的原理？",
    content: "大家好！我在学习色彩理论时对互补色、类似色和三角色搭配有点困惑。谁能帮我解释一下这些色彩搭配方式的区别？特别是如何在实际设计中应用这些原理。",
    author: {
      id: "usr_3n7q1w",
      name: "Catalina",
      avatar: undefined  // No avatar, will display default avatar
    },
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    tags: ["设计理论", "色彩搭配", "视觉设计"],
    likesCount: 12,
    commentsCount: 5,
    isLiked: false,
  },
  {
    id: "b6c4e2a8",
    title: "Database: SQL Query Optimization Tips",
    content: `
            <h2>Database queries running super slow - help!</h2>
            <p>My database course project queries are taking forever. I've tried a few things but nothing seems to work. Here's what I'm dealing with:</p>
            <h3>My current query</h3>
            <pre><code class="language-sql">SELECT o.id, o.customer_id, SUM(i.amount) AS total
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.created_at &gt; NOW() - INTERVAL '7 days'
GROUP BY o.id, o.customer_id
ORDER BY total DESC
LIMIT 10;</code></pre>
            <p>This takes like 5+ seconds on a table with 100k records. I know it's not huge but still...</p>
            <h3>Questions:</h3>
            <ol>
                <li>Should I add indexes? Which columns exactly?</li>
                <li>Is the <code>JOIN</code> the problem or the <code>WHERE</code> clause?</li>
                <li>My professor mentioned <code>EXPLAIN</code> - how do I read the output?</li>
                <li>Any other optimization tricks I should know?</li>
            </ol>
            <p>Really need help before the deadline! 🙏</p>
        `,
    author: {
      id: "usr_5m9k2x",
      name: "Mike",
      avatar: undefined  // No avatar, will display default avatar
    },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    tags: ["Database", "SQL", "Performance"],
    likesCount: 25,
    commentsCount: 12,
    isLiked: false,
  },
  {
    id: "f1a8d3c7",
    title: "會計學：財務報表分析嘅重點",
    content: `
            <h2>財務報表分析 - 現金流量表睇唔明</h2>
            <p>我哋會計課要分析公司嘅財務報表，但係我對現金流量表完全冇頭緒。老師講咗幾個比率：</p>
            <ul>
                <li>流動比率 = <code>流動資產 / 流動負債</code></li>
                <li>速動比率 = <code>(流動資產 - 存貨) / 流動負債</code></li>
            </ul>
            <p>但係我想問：</p>
            <ol>
                <li>呢啲比率點樣睇先算係「好」？有冇標準？</li>
                <li>點樣分析營運現金流？睇邊個數字？</li>
                <li>唔同行業嘅比率係咪唔同？點樣比較？</li>
                <li>有冇同學可以分享下分析嘅步驟？</li>
            </ol>
            <p>真係好需要幫助，下個禮拜就要交功課了！</p>
        `,
    author: {
      id: "usr_2j8n4p",
      name: "Emma",
      avatar: undefined  // No avatar, will display default avatar
    },
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    tags: ["會計學", "財務報表", "財務分析"],
    likesCount: 15,
    commentsCount: 7,
    isLiked: true,
  },
  {
    id: "c9e6b1f5",
    title: "中國文學：唐詩宋詞嘅意境分析",
    content: `
            <h2>唐詩宋詞嘅「意境」點樣分析？</h2>
            <p>我哋文學課要分析詩詞嘅意境，但係我對「意境」呢個概念完全唔明。老師話要從<strong>情、景、意</strong>三方面睇：</p>
            <ol>
                <li>情：詩人主觀情感</li>
                <li>景：客觀圖景 / 意象</li>
                <li>意：二者交融後的餘韻</li>
            </ol>
            <p>但係我想問：</p>
            <ul>
                <li>點樣識別詩人嘅情感？有咩技巧？</li>
                <li>意象同意境有咩分別？</li>
                <li>點樣分析「餘韻」？有冇具體方法？</li>
            </ul>
            <blockquote>「無邊落木蕭蕭下，不盡長江滾滾來。」</blockquote>
            <p>呢句詩點樣體現意境？有冇同學可以幫我分析下？</p>
        `,
    author: {
      id: "usr_7q3w9k",
      name: "David",
      avatar: undefined
    },
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    tags: ["中國文學", "唐詩宋詞", "意境分析"],
    likesCount: 9,
    commentsCount: 4,
    isLiked: false,
  },
  {
    id: "d4a7f2e9",
    title: "Civil Engineering: Structural Analysis for Bridge Design",
    content: `
            <h2>Bridge design - moment calculations confusing me</h2>
            <p>I'm working on my bridge design project and I'm really struggling with the structural analysis calculations. I need to calculate the moment distribution for a simply supported beam, but I'm not sure if I'm doing it right.</p>
            <p>I found this formula:</p>
            <pre><code class="language-text">For point load P at midspan L:
                M_max = P * L / 4
            </code></pre>
            <p>But I have so many questions:</p>
            <ol>
                <li>Is this formula only for point loads at the center? What about distributed loads?</li>
                <li>How do I handle multiple loads on the same beam?</li>
                <li>My professor mentioned "influence lines" - what are those?</li>
                <li>When should I use FEA software vs hand calculations?</li>
                <li>Any tips for checking if my calculations are reasonable?</li>
            </ol>
            <p>Really need help before the project deadline! Any civil engineering students here?</p>
        `,
    author: {
      id: "usr_1n5m8x",
      name: "Sophie",
      avatar: undefined  // No avatar, will display default avatar
    },
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    tags: ["Civil Engineering", "Structural Analysis", "Bridge Design"],
    likesCount: 18,
    commentsCount: 8,
    isLiked: true,
  }
];

// Auto-extend sample posts for demo purposes
for (let i = 1; i <= 24; i++) {
  const id = `demo-post-${i}`;
  initialSamplePosts.push({
    id,
    title: `Demo Post ${i}: Study Tips and Discussions`,
    content: `<p>This is demo forum post #${i}. Share your study tips, project experiences, and course insights here. This content is generated for pagination showcase.</p>`,
    author: {
      id: `demo_user_${(i % 8) + 1}`,
      name: `DemoUser${(i % 8) + 1}`,
      avatar: undefined
    },
    createdAt: new Date(Date.now() - (i + 18) * 60 * 60 * 1000).toISOString(),
    tags: i % 2 === 0 ? ["General", "Study"] : ["Project", "Help"],
    likesCount: (i * 2) % 37,
    commentsCount: (i * 3) % 18,
    isLiked: false,
  });
}

// Storage key for localStorage
const STORAGE_KEY = 'project-consensus-posts';

// Load posts from localStorage or use initial data
function loadPostsFromStorage(): ForumPost[] {
  if (typeof window === 'undefined') {
    // Server-side rendering, return initial data
    return initialSamplePosts;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with initial posts to ensure we always have the base data
      const existingIds = new Set(parsed.map((p: ForumPost) => p.id));
      const newInitialPosts = initialSamplePosts.filter(p => !existingIds.has(p.id));
      const mergedPosts = [...parsed, ...newInitialPosts];
      mergedPosts.sort((a: ForumPost, b: ForumPost) => {
        // Sort descending (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return mergedPosts;
    }
  } catch (error) {
    console.error('Error loading posts from localStorage:', error);
  }
  
  return initialSamplePosts;
}

// Save posts to localStorage
function savePostsToStorage(posts: ForumPost[]): void {
  if (typeof window === 'undefined') {
    return; // Server-side rendering, skip
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch (error) {
    console.error('Error saving posts to localStorage:', error);
  }
}

// Initialize posts array with data from localStorage
export const samplePosts: ForumPost[] = loadPostsFromStorage();

/**
 * Toggle like state for a post and return the updated post.
 * Note: This function directly modifies the original samplePosts array.
 * Returns the updated post if found; otherwise undefined.
 */
export function toggleLikeById(postId: string): ForumPost | undefined {
  const index = samplePosts.findIndex(p => p.id === postId);
  if (index === -1) return undefined;
  
  const post = samplePosts[index];
  const currentlyLiked = !!post.isLiked;
  const nextLiked = !currentlyLiked;
  const nextLikes = Math.max(0, (post.likesCount ?? 0) + (nextLiked ? 1 : -1));
  
  // Directly modify the original post object
  post.isLiked = nextLiked;
  post.likesCount = nextLikes;
  
  // Save to localStorage
  savePostsToStorage(samplePosts);
  
  return post;
}

/**
 * Add a new post to the sample data
 */
export function addPost(post: ForumPost): ForumPost {
  samplePosts.push(post);
  savePostsToStorage(samplePosts);
  return post;
}

/**
 * Update post content
 */
export function updatePost(postId: string, updates: Partial<ForumPost>): ForumPost | undefined {
  const index = samplePosts.findIndex(p => p.id === postId);
  if (index === -1) return undefined;
  
  const post = samplePosts[index];
  Object.assign(post, updates);
  
  // Save to localStorage
  savePostsToStorage(samplePosts);
  
  return post;
}

/**
 * Delete a post (remove from array)
 */
export function deletePost(postId: string): boolean {
  const index = samplePosts.findIndex(p => p.id === postId);
  if (index === -1) return false;
  
  samplePosts.splice(index, 1);
  
  // Save to localStorage
  savePostsToStorage(samplePosts);
  
  return true;
}

/**
 * Get post by ID
 */
export function getPostById(postId: string): ForumPost | undefined {
  return samplePosts.find(p => p.id === postId);
}
