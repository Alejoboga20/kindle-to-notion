import type { KindleHighlight } from '../kindle/kindle.schema.js';

/**
 * Renders highlights as Markdown, grouped under `##` chapter headings in
 * first-seen order. Highlights with no chapter (content before the first
 * heading) are listed first, with no heading.
 */
export function generateMarkdown(highlights: KindleHighlight[]): string {
  if (highlights.length === 0) {
    throw new Error('Cannot generate Markdown from an empty highlights list');
  }

  const { bookTitle, author } = highlights[0]!;

  const chapters = new Map<string, KindleHighlight[]>();
  for (const highlight of highlights) {
    const group = chapters.get(highlight.chapter);
    if (group) {
      group.push(highlight);
    } else {
      chapters.set(highlight.chapter, [highlight]);
    }
  }

  const lines: string[] = [`# ${bookTitle}`, '', `*by ${author}*`];

  console.log({ chapters });

  for (const [chapter, entries] of chapters) {
    lines.push('');
    if (chapter) {
      lines.push(`## ${chapter}`);
    }
    for (const entry of entries) {
      lines.push(`- (Page ${entry.location}) ${entry.content}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
