"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/hooks/useI18n"
import { useApp } from "@/contexts/AppContext"
import { useRouter } from "next/navigation"

export default function CreateForumPostButton() {
  const pathname = usePathname()
  const { t } = useI18n()
  const { isLoggedIn, openLoginModal } = useApp()
  const router = useRouter()

  if (pathname !== "/") return null

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        asChild
        size="lg"
        className="rounded-full px-5 py-3 shadow-lg hover:shadow-xl transition-shadow"
      >
        <Link
          href="/post/new"
          aria-label={t("post.create")}
          onClick={(e) => {
            if (!isLoggedIn) {
              e.preventDefault()
              openLoginModal()
            }
          }}
        >
          <Plus className="mr-2" />
          <span>{t("post.create")}</span>
        </Link>
      </Button>
    </div>
  )
}


