import { describe, expect, it } from 'vitest';
import { generateMarkdown } from './markdown-generator.js';
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

describe('generateMarkdown', () => {
  it('throws on an empty list', () => {
    expect(() => generateMarkdown([])).toThrow();
  });

  it('groups by chapter in first-seen order and preserves entry order within a chapter', () => {
    const md = generateMarkdown([
      highlight({ chapter: 'Preface', location: 'x', content: 'First.' }),
      highlight({ chapter: 'Introduction', location: '4', content: 'Second.' }),
      highlight({ chapter: 'Preface', location: 'xi', content: 'Third.' }),
    ]);

    const chapterOrder = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(chapterOrder).toEqual(['Preface', 'Introduction']);

    const prefaceSection = md.split('## Introduction')[0]!;
    expect(prefaceSection.indexOf('First.')).toBeLessThan(prefaceSection.indexOf('Third.'));
  });

  it('lists chapter-less highlights first without a heading', () => {
    const md = generateMarkdown([
      highlight({ chapter: '', content: 'Unheaded.' }),
      highlight({ chapter: 'Introduction', content: 'Headed.' }),
    ]);
    const headingIndex = md.indexOf('## Introduction');
    const unheadedIndex = md.indexOf('Unheaded.');
    expect(unheadedIndex).toBeGreaterThan(-1);
    expect(unheadedIndex).toBeLessThan(headingIndex);
  });

  it('includes title, author, and page label per bullet', () => {
    const md = generateMarkdown([highlight({ location: 'xi', content: 'Some text.' })]);
    expect(md).toContain('# The Obstacle is the Way');
    expect(md).toContain('*by Holiday, Ryan*');
    expect(md).toContain('- (Page xi) Some text.');
  });
});
