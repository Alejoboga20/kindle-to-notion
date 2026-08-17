import {
  kindleNotebookSchema,
  type KindleHighlight,
  type KindleNotebook,
} from './kindle.schema.js';

const ENTRY_HEADER_RE = /^Page\s+(\S+)\s*\|\s*(Underline|Highlight|Note)/i;
const DATE_RE = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/;
const AUTHOR_RE = /^by\s+(.+)$/;
const FOOTER_PAGE_NUMBER_RE = /^\d{1,4}$/;
const PREVIEW_LINK_RE = /^Free Kindle instant preview:/i;
const ANNOTATIONS_SUMMARY_RE = /^Annotations\s*\(\d+\)/i;
const BULLET_SUMMARY_RE = /^[•·]\s/;
const SENTENCE_END_RE = /[.!?"'”’)\]]$/;
const LOWERCASE_START_RE = /^[a-z]/;

/**
 * Lines that are structural noise in the Kindle notebook export and must never be
 * mistaken for a chapter/section heading. Only checked while no entry is open.
 */
export function isNoiseLine(line: string): boolean {
  return (
    FOOTER_PAGE_NUMBER_RE.test(line) ||
    PREVIEW_LINK_RE.test(line) ||
    ANNOTATIONS_SUMMARY_RE.test(line) ||
    BULLET_SUMMARY_RE.test(line)
  );
}

interface RawEntry {
  chapter: string;
  location: string;
  type: string;
  content: string;
}

/**
 * Merges highlights that were split across a page break into a single entry.
 * Heuristic: entry N's content lacks sentence-ending punctuation AND entry N+1's
 * content starts lowercase => they are one continuous highlight. Merges can chain
 * across more than two entries. Dates/proximity are never used as merge evidence.
 */
export function mergeSplitHighlights(entries: KindleHighlight[]): KindleHighlight[] {
  const merged: KindleHighlight[] = [];

  for (const entry of entries) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      !SENTENCE_END_RE.test(previous.content) &&
      LOWERCASE_START_RE.test(entry.content)
    ) {
      previous.content = `${previous.content} ${entry.content}`;
    } else {
      merged.push({ ...entry });
    }
  }

  return merged;
}

/**
 * Parses the raw line layer of a Kindle "Notebook" PDF export into a KindleNotebook:
 * book title, author, and highlights grouped implicitly by chapter (via the `chapter`
 * field on each highlight). Notes are dropped. Split highlights are merged.
 */
export function parseKindleNotebook(lines: string[]): KindleNotebook {
  let bookTitle: string | undefined;
  let author: string | undefined;
  let headerLineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (isNoiseLine(line)) continue;

    const authorMatch = AUTHOR_RE.exec(line);
    if (authorMatch) {
      author = authorMatch[1]!.trim();
      headerLineIndex = i + 1;
      break;
    }

    if (!bookTitle) {
      bookTitle = line;
    }
  }

  if (!bookTitle) {
    throw new Error('Could not find book title in PDF text');
  }
  if (!author) {
    throw new Error('Could not find author line ("by <author>") in PDF text');
  }

  const rawEntries: RawEntry[] = [];
  let currentChapter = '';
  let openEntry: { location: string; type: string; buffer: string[] } | null = null;

  for (let i = headerLineIndex; i < lines.length; i++) {
    const line = lines[i]!;

    const headerMatch = ENTRY_HEADER_RE.exec(line);
    if (headerMatch) {
      openEntry = { location: headerMatch[1]!, type: headerMatch[2]!, buffer: [] };
      continue;
    }

    if (openEntry) {
      if (DATE_RE.test(line)) {
        const content = openEntry.buffer.join(' ').trim();
        if (openEntry.type.toLowerCase() !== 'note' && content.length > 0) {
          rawEntries.push({
            chapter: currentChapter,
            location: openEntry.location,
            type: openEntry.type,
            content,
          });
        }
        openEntry = null;
      } else {
        openEntry.buffer.push(line);
      }
      continue;
    }

    if (!isNoiseLine(line)) {
      currentChapter = line;
    }
  }

  const highlights: KindleHighlight[] = rawEntries.map((entry) => ({
    bookTitle: bookTitle!,
    author: author!,
    chapter: entry.chapter,
    location: entry.location,
    content: entry.content,
  }));

  return kindleNotebookSchema.parse({
    bookTitle,
    author,
    highlights: mergeSplitHighlights(highlights),
  });
}
