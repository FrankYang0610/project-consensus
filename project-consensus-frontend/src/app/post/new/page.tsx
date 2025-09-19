"use client";

import * as React from "react";

import dynamic from "next/dynamic";
// Dynamic import for client-only CKEditor component
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

import { SiteNavigation } from "@/components/SiteNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useI18n } from "@/hooks/useI18n";
import { useRouter } from "next/navigation";

export default function NewForumPostPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");

  // Scroll to top when component mounts
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("post.titlePlaceholder")}
                    className="mb-3 h-11 text-lg md:text-lg font-normal px-4"
                  />
                  <RichTextEditor
                    value={content}
                    onChange={setContent}
                    placeholder={t("post.contentPlaceholder")}
                    className="prose max-w-none"
                    // TODO: 配置图片上传接口 / Configure image upload endpoint
                    // uploadUrl="/api/upload/image" // 图片上传接口地址 / Image upload endpoint
                    // uploadHeaders={{ "Authorization": "Bearer your-token" }} // 认证头 / Auth headers
                    // onUploadError={(error) => console.error("Upload failed:", error)} // 上传错误处理 / Upload error handling
                  />
                </CardContent>
                <CardFooter className="gap-3">
                  <Button onClick={() => { /* TODO: submit handler */ }}>
                    {t("post.create")}
                  </Button>
                  <Button variant="ghost" onClick={() => router.back()}>
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


