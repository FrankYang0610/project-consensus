import { ForumPost } from "@/types/forum";

// Sample data - Computer Science course discussions
export const samplePosts: ForumPost[] = [
    {
        id: "a7f3b2c1",
        title: "Java編程：接口同抽象類嘅分別",
        content: "老師上堂講咗接口同抽象類，但我都係唔係好明幾時用接口，幾時用抽象類。有冇人可以舉個具體嘅例子？",
        author: {
            id: "usr_9k2m8x",
            name: "Sarah",
            avatar: undefined  // No avatar, will display default avatar
        },
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        tags: ["Java", "面向對象", "編程基礎"],
        likes: 8,
        comments: 3,
        isLiked: true,
        language: "繁体中文（粵語）"
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
        likes: 12,
        comments: 5,
        isLiked: false,
        language: "简体中文（普通话）"
    },
    {
        id: "b6c4e2a8",
        title: "Database: SQL Query Optimization Tips",
        content: "I'm working on my database course project and the queries are running really slow. My professor mentioned optimizing SQL statements but I don't know where to start. Any common optimization techniques you can share?",
        author: {
            id: "usr_5m9k2x",
            name: "Mike",
            avatar: undefined  // No avatar, will display default avatar
        },
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        tags: ["Database", "SQL", "Performance"],
        likes: 25,
        comments: 12,
        isLiked: false,
        language: "English (Hong Kong)"
    },
    {
        id: "f1a8d3c7",
        title: "會計學：財務報表分析嘅重點",
        content: "我哋會計課要分析公司嘅財務報表，但係我唔係好識點樣睇現金流量表。有冇同學可以教下我點樣分析流動比率同速動比率？",
        author: {
            id: "usr_2j8n4p",
            name: "Emma",
            avatar: undefined  // No avatar, will display default avatar
        },
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        tags: ["會計學", "財務報表", "財務分析"],
        likes: 15,
        comments: 7,
        isLiked: true,
        language: "繁体中文（粵語）"
    },
    {
        id: "c9e6b1f5",
        title: "中國文學：唐詩宋詞嘅意境分析",
        content: "我哋文學課要分析唐詩宋詞嘅意境，但係我對「意境」呢個概念唔係好明。有冇人可以解釋下點樣理解詩詞入面嘅意境？特別係點樣分析詩人嘅情感表達？",
        author: {
            id: "usr_7q3w9k",
            name: "David",
            avatar: undefined
        },
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        tags: ["中國文學", "唐詩宋詞", "意境分析"],
        likes: 9,
        comments: 4,
        isLiked: false,
        language: "繁体中文（粵語）"
    },
    {
        id: "d4a7f2e9",
        title: "Civil Engineering: Structural Analysis for Bridge Design",
        content: "I'm working on my bridge design project and I'm struggling with the structural analysis calculations. Can anyone help me understand how to calculate the moment distribution for a simply supported beam? I need to determine the maximum bending moment for my design.",
        author: {
            id: "usr_1n5m8x",
            name: "Sophie",
            avatar: undefined  // No avatar, will display default avatar
        },
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        tags: ["Civil Engineering", "Structural Analysis", "Bridge Design"],
        likes: 18,
        comments: 8,
        isLiked: true,
        language: "English (Hong Kong)"
    }
];

/**
 * Toggle like state for a post and mutate the in-memory samplePosts data.
 * Returns the updated post if found; otherwise undefined.
 */
export function toggleLikeById(postId: string): ForumPost | undefined {
    const index = samplePosts.findIndex(p => p.id === postId);
    if (index === -1) return undefined;
    const post = samplePosts[index];
    const currentlyLiked = !!post.isLiked;
    const nextLiked = !currentlyLiked;
    const nextLikes = Math.max(0, post.likes + (nextLiked ? 1 : -1));
    // Mutate in place to reflect global change
    post.isLiked = nextLiked;
    post.likes = nextLikes;
    return post;
}
