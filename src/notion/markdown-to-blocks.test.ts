import { describe, expect, it } from 'vitest';
import {
  buildNotionBlocks,
  chunkBlocks,
  NOTION_MAX_BLOCKS_PER_REQUEST,
} from './markdown-to-blocks.js';
import type { KindleHighlight } from '../kindle/kindle.schema.js';

function highlight(overrides: Partial<KindleHighlight>): KindleHighlight {
  return {
    bookTitle: 'The Obstacle is the Way',
    author: 'Holiday, Ryan',
    chapter: 'Introduction',
    location: '4',
    content: 'A highlight.',
    ...overrides,
  };
}

function richText(block: Record<string, unknown>, blockType: string): string {
  const body = block[blockType] as { rich_text: Array<{ text: { content: string } }> };

  return body.rich_text[0]!.text.content;
}

describe('buildNotionBlocks', () => {
  it('throws on an empty list', () => {
    expect(() => buildNotionBlocks([])).toThrow();
  });

  it('leads with an italic author paragraph', () => {
    const blocks = buildNotionBlocks([highlight({})]);
    expect(blocks[0]!.type).toBe('paragraph');
    expect(richText(blocks[0]! as unknown as Record<string, unknown>, 'paragraph')).toBe(
      'by Holiday, Ryan',
    );
  });

  it('groups by chapter in first-seen order, merging non-contiguous entries', () => {
    const blocks = buildNotionBlocks([
      highlight({ chapter: 'Preface', location: 'x', content: 'First.' }),
      highlight({ chapter: 'Introduction', location: '4', content: 'Second.' }),
      highlight({ chapter: 'Preface', location: 'xi', content: 'Third.' }),
    ]);

    const headings = blocks
      .filter((b) => b.type === 'heading_2')
      .map((b) => richText(b as unknown as Record<string, unknown>, 'heading_2'));
    expect(headings).toEqual(['Preface', 'Introduction']);

    const bullets = blocks
      .filter((b) => b.type === 'bulleted_list_item')
      .map((b) => richText(b as unknown as Record<string, unknown>, 'bulleted_list_item'));
    expect(bullets).toEqual(['(Page x) First.', '(Page xi) Third.', '(Page 4) Second.']);
  });

  it('omits a heading for chapter-less highlights', () => {
    const blocks = buildNotionBlocks([highlight({ chapter: '', content: 'Unheaded.' })]);
    expect(blocks.some((b) => b.type === 'heading_2')).toBe(false);
  });
});

describe('chunkBlocks', () => {
  it('splits blocks into chunks of the given size', () => {
    const blocks = Array.from(
      { length: 250 },
      () => ({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [] } }) as never,
    );

    const chunks = chunkBlocks(blocks, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });

  it('defaults to the Notion 100-block-per-request limit', () => {
    const blocks = Array.from(
      { length: 101 },
      () => ({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [] } }) as never,
    );

    const chunks = chunkBlocks(blocks);
    expect(chunks[0]).toHaveLength(NOTION_MAX_BLOCKS_PER_REQUEST);
    expect(chunks[1]).toHaveLength(1);
  });
});
