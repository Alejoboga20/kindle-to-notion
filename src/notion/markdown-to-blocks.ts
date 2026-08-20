import type { BlockObjectRequest } from '@notionhq/client';
import type { KindleHighlight } from '../kindle/kindle.schema.js';

export const NOTION_MAX_BLOCKS_PER_REQUEST = 100;

/**
 * Converts highlights (already grouped by chapter in first-seen order,
 * same shape `markdown-generator.ts` renders to Markdown) directly into
 * Notion blocks, skipping the Markdown string as an intermediate form.
 */
export function buildNotionBlocks(highlights: KindleHighlight[]): BlockObjectRequest[] {
  if (highlights.length === 0) {
    throw new Error('Cannot build Notion blocks from an empty highlights list');
  }

  const { author } = highlights[0]!;
  const blocks: BlockObjectRequest[] = [paragraph(`by ${author}`, { italic: true })];

  const chapters = new Map<string, KindleHighlight[]>();
  for (const highlight of highlights) {
    const group = chapters.get(highlight.chapter);
    if (group) {
      group.push(highlight);
    } else {
      chapters.set(highlight.chapter, [highlight]);
    }
  }

  for (const [chapter, entries] of chapters) {
    if (chapter) {
      blocks.push(heading2(chapter));
    }
    for (const entry of entries) {
      blocks.push(bulletedListItem(`(Page ${entry.location}) ${entry.content}`));
    }
  }

  return blocks;
}

/** Splits blocks into chunks respecting Notion's 100-block-per-request limit. */
export function chunkBlocks(
  blocks: BlockObjectRequest[],
  size: number = NOTION_MAX_BLOCKS_PER_REQUEST,
): BlockObjectRequest[][] {
  const chunks: BlockObjectRequest[][] = [];
  for (let i = 0; i < blocks.length; i += size) {
    chunks.push(blocks.slice(i, i + size));
  }

  return chunks;
}

function paragraph(text: string, options: { italic?: boolean } = {}): BlockObjectRequest {
  return {
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: { content: text },
          annotations: options.italic ? { italic: true } : undefined,
        },
      ],
    },
  };
}

function heading2(text: string): BlockObjectRequest {
  return {
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function bulletedListItem(text: string): BlockObjectRequest {
  return {
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}
