"use client";

import * as React from "react";

import dynamic from "next/dynamic";
// Dynamic import for client-only CKEditor component
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

import { SiteNavigation } from "@/components/SiteNavigation";
import { TagManager } from "@/components/TagManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useI18n } from "@/hooks/useI18n";
import { useRouter } from "next/navigation";
import { ForumPost } from "@/types";
import { apiPost } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";

export default function NewForumPostPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { isLoggedIn, openLoginModal } = useApp();
  // 如果在发帖页退出登录，返回上一页
  React.useEffect(() => {
    if (!isLoggedIn) {
      // 若是直接输入地址打开且未登录，也保持现状（留在此页），直到尝试提交时弹登录
      // 仅在用户由已登录 -> 退出登录的状态变更时，执行返回
      // 通过历史记录检测：如果有可返回历史则返回
      if (window.history.length > 1) {
        router.back();
      }
    }
  }, [isLoggedIn, router]);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  
  // 表单状态管理 / Form state management
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    title?: string;
    content?: string;
    tags?: string;
  }>({});

  // Scroll to top when component mounts
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 表单验证函数 / Form validation function
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    // 验证标题 / Validate title
    if (!title.trim()) {
      newErrors.title = t("post.validation.titleRequired");
    } else if (title.trim().length < 5) {
      newErrors.title = t("post.validation.titleTooShort");
    } else if (title.trim().length > 200) {
      newErrors.title = t("post.validation.titleTooLong");
    }
    
    // 验证内容 / Validate content
    if (!content.trim()) {
      newErrors.content = t("post.validation.contentRequired");
    } else if (content.trim().length < 10) {
      newErrors.content = t("post.validation.contentTooShort");
    }
    
    // 验证标签 / Validate tags
    if (tags.length > 10) {
      newErrors.tags = t("post.validation.tooManyTags");
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交处理函数 / Submit handler function
  const handleSubmit = async () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    // 验证表单 / Validate form
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        tags: tags,
        language: "zh-hans",
      };
      const created = await apiPost<ForumPost>(`/api/forum/posts/`, payload);
      router.push(`/post/${created.id}`);
    } catch (error) {
      console.error("提交帖子时出错 / Error submitting post:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-8">
          <div className="w-full p-6">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-2xl font-semibold mb-4">{t("post.newTitle")}</h1>
              <Card>
                <CardContent>
                  <div className="mb-3">
                    <Input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        // 清除标题错误 / Clear title error
                        if (errors.title) {
                          setErrors(prev => ({ ...prev, title: undefined }));
                        }
                      }}
                      placeholder={t("post.titlePlaceholder")}
                      className={`h-11 text-lg md:text-lg font-normal px-4 ${
                        errors.title ? "border-red-500 focus:border-red-500" : ""
                      }`}
                    />
                    {errors.title && (
                      <p className="text-red-500 text-sm mt-1">{errors.title}</p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <RichTextEditor
                      value={content}
                      onChange={(value) => {
                        setContent(value);
                        // 清除内容错误 / Clear content error
                        if (errors.content) {
                          setErrors(prev => ({ ...prev, content: undefined }));
                        }
                      }}
                      placeholder={t("post.contentPlaceholder")}
                      className="prose max-w-none"
                    />
                    {errors.content && (
                      <p className="text-red-500 text-sm mt-1">{errors.content}</p>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <TagManager
                      tags={tags}
                      onTagsChange={(newTags) => {
                        setTags(newTags);
                        // 清除标签错误 / Clear tags error
                        if (errors.tags) {
                          setErrors(prev => ({ ...prev, tags: undefined }));
                        }
                      }}
                      maxTags={10}
                    />
                    {errors.tags && (
                      <p className="text-red-500 text-sm mt-1">{errors.tags}</p>
                    )}
                  </div>
                  
                  { /* NOTE: Images are embedded as Base64 for now. TODO: server upload. */}
                </CardContent>
                <CardFooter className="gap-3">
                  <Button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="min-w-[100px]"
                  >
                    {isSubmitting ? t("post.submitting") : t("post.create")}
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    {t("post.cancel")}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}


