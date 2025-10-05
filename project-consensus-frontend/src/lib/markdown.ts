import GithubSlugger from 'github-slugger';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema, type Schema } from 'hast-util-sanitize';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeStringify from 'rehype-stringify';

export interface TocItem {
  id: string;
  text: string;
  depth: number; // 1..6
}

// Unique slug generation is handled by GithubSlugger instances.
export function extractHeadings(markdown: string): TocItem[] {
  const lines = markdown.split(/\r?\n/);
  const items: TocItem[] = [];
  let inCode = false;
  const slugger = new GithubSlugger();
  for (const line of lines) {
    // track fenced code blocks and ignore headings inside them
    if (/^```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) {
      const depth = m[1].length;
      const raw = m[2].replace(/\s+#*\s*$/, '');
      const id = slugger.slug(raw);
      items.push({ id, text: raw, depth });
    }
  }
  return items;
}

// Render Markdown to sanitized HTML using unified/remark/rehype pipeline
export function renderMarkdownToHtml(markdown: string): string {
  // Extend sanitize schema to allow heading id/className and code/pre/anchor classes
  const schema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [
        ...(defaultSchema.attributes?.code || []),
        ['className'],
      ],
      pre: [
        ...(defaultSchema.attributes?.pre || []),
        ['className'],
      ],
      a: [
        ...(defaultSchema.attributes?.a || []),
        ['className'],
        ['href'],
        ['rel'],
        ['target'],
      ],
      span: [
        ...(defaultSchema.attributes?.span || []),
        ['className'],
      ],
      h1: [ ...(defaultSchema.attributes?.h1 || []), ['id'], ['className'] ],
      h2: [ ...(defaultSchema.attributes?.h2 || []), ['id'], ['className'] ],
      h3: [ ...(defaultSchema.attributes?.h3 || []), ['id'], ['className'] ],
      h4: [ ...(defaultSchema.attributes?.h4 || []), ['id'], ['className'] ],
      h5: [ ...(defaultSchema.attributes?.h5 || []), ['id'], ['className'] ],
      h6: [ ...(defaultSchema.attributes?.h6 || []), ['id'], ['className'] ],
    },
  } as unknown as Schema;

  const vfile = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeSanitize, schema)
    .use(rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] })
    .use(rehypeStringify)
    .processSync(markdown || '');

  return String(vfile);
}
