/* eslint-disable @next/next/no-img-element */
import React from 'react';

// MDX component mappings used by Wiki pages
export const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 {...props} className={"text-3xl font-bold mt-6 mb-4 " + (props.className ?? '')} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props} className={"text-2xl font-semibold mt-5 mb-3 " + (props.className ?? '')} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props} className={"text-xl font-semibold mt-4 mb-2 " + (props.className ?? '')} />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 {...props} className={"text-lg font-semibold mt-3 mb-2 " + (props.className ?? '')} />
  ),
  h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h5 {...props} className={"text-base font-semibold mt-2 mb-1 " + (props.className ?? '')} />
  ),
  h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h6 {...props} className={"text-sm font-semibold mt-2 mb-1 uppercase tracking-wide text-neutral-600 dark:text-neutral-400 " + (props.className ?? '')} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className={"leading-7 my-3 " + (props.className ?? '')} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className={"list-disc pl-6 my-3 space-y-1 " + (props.className ?? '')} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className={"list-decimal pl-6 my-3 space-y-1 " + (props.className ?? '')} />
  ),
  li: (props: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li {...props} className={(props.className ?? '')} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const { href, className, target, rel, ...rest } = props;
    const h = href || '';
    const isHash = h.startsWith('#');
    const isInternal = isHash || h.startsWith('/') || h.startsWith('./') || h.startsWith('../');
    const isMailOrTel = h.startsWith('mailto:') || h.startsWith('tel:');
    const isExternal = !isInternal && !isMailOrTel && /^https?:\/\//i.test(h);
    const finalTarget = target ?? (isExternal ? '_blank' : undefined);
    const finalRel = rel ?? (isExternal ? 'noopener noreferrer' : undefined);
    return (
      <a
        {...rest}
        href={href}
        className={"text-blue-600 underline underline-offset-2 hover:text-blue-700 " + (className ?? '')}
        {...(finalTarget ? { target: finalTarget } as const : {})}
        {...(finalRel ? { rel: finalRel } as const : {})}
      />
    );
  },
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code {...props} className={"bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded " + (props.className ?? '')} />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre {...props} className={"bg-neutral-100 dark:bg-neutral-900 p-3 rounded overflow-x-auto text-sm " + (props.className ?? '')} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLElement>) => (
    <blockquote {...props} className={"border-l-4 border-neutral-300 pl-3 italic text-neutral-700 dark:text-neutral-300 " + (props.className ?? '')} />
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className={"my-6 border-t border-neutral-200 dark:border-neutral-800 " + (props.className ?? '')} />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong {...props} className={(props.className ?? '')} />
  ),
  em: (props: React.HTMLAttributes<HTMLElement>) => (
    <em {...props} className={(props.className ?? '')} />
  ),
  del: (props: React.HTMLAttributes<HTMLElement>) => (
    <del {...props} className={(props.className ?? '')} />
  ),
  kbd: (props: React.HTMLAttributes<HTMLElement>) => (
    <kbd {...props} className={"px-1.5 py-0.5 text-xs font-mono border rounded bg-neutral-50 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 " + (props.className ?? '')} />
  ),
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img
      {...props}
      alt={props.alt ?? ''}
      loading={props.loading ?? 'lazy'}
      className={"max-w-full h-auto rounded " + (props.className ?? '')}
    />
  ),
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-4 w-full overflow-x-auto">
      <table {...props} className={"w-full border-collapse text-sm " + (props.className ?? '')} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead {...props} className={(props.className ?? '')} />
  ),
  tbody: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody {...props} className={(props.className ?? '')} />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr {...props} className={(props.className ?? '')} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th {...props} className={"border px-3 py-2 text-left bg-neutral-50 dark:bg-neutral-900 " + (props.className ?? '')} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td {...props} className={"border px-3 py-2 align-top " + (props.className ?? '')} />
  ),
  // Custom callouts
  Callout: ({ children }: { children?: React.ReactNode }) => (
    <div className="border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/30 p-3 my-3 rounded">{children}</div>
  ),
  Note: ({ children }: { children?: React.ReactNode }) => (
    <div className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 my-3 rounded">{children}</div>
  ),
  Warning: ({ children }: { children?: React.ReactNode }) => (
    <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-950/30 p-3 my-3 rounded">{children}</div>
  ),
};

