import Image from "next/image";
import { SiteNavigation } from "@/components/SiteNavigation";

export default function HomePage() {
  return (
      <>
          <SiteNavigation />
          <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
              <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
                  <Image
                      className="dark:invert"
                      src="/project-consensus-icon.svg"
                      alt="project-consensus-icon"
                      width={300}
                      height={60}
                      priority
                  />
                  <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
                      <li className="mb-2 tracking-[-.01em]">
                          Get started by editing{" "}
                          <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
                              src/app/page.tsx
                          </code>
                          .
                      </li>
                      <li className="tracking-[-.01em]">
                          Save and see the changes instantly.
                      </li>
                  </ol>

                  <div className="flex gap-4 items-center flex-col sm:flex-row">
                  </div>
              </main>
              <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
              </footer>
          </div>
      </>
  );
}
