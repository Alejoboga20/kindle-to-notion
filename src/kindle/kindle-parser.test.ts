import { describe, expect, it } from 'vitest';
import { isNoiseLine, mergeSplitHighlights, parseKindleNotebook } from './kindle-parser.js';
import type { KindleHighlight } from './kindle.schema.js';

const HEADER = [
  '1',
  'The Obstacle is the Way',
  'by Holiday, Ryan',
  'Free Kindle instant preview: https://read.amazon.com/kp/kshare?asin=XYZ',
  'Annotations (5)',
  '• 4 Underlines | Default (4)',
  '• 1 Note',
];

function notebookLines(body: string[]): string[] {
  return [...HEADER, ...body];
}

describe('isNoiseLine', () => {
  it('flags footer page numbers, preview links, and summary bullets', () => {
    expect(isNoiseLine('2')).toBe(true);
    expect(isNoiseLine('Free Kindle instant preview: https://x')).toBe(true);
    expect(isNoiseLine('Annotations (22)')).toBe(true);
    expect(isNoiseLine('• 21 Underlines | Default (21)')).toBe(true);
    expect(isNoiseLine('Introduction')).toBe(false);
  });
});

describe('parseKindleNotebook', () => {
  it('extracts book title and author', () => {
    const notebook = parseKindleNotebook(
      notebookLines([
        'Introduction',
        'Page 4 | Underline (Default)',
        'Some highlight.',
        'Aug 13, 2026',
      ]),
    );
    expect(notebook.bookTitle).toBe('The Obstacle is the Way');
    expect(notebook.author).toBe('Holiday, Ryan');
  });

  it('throws when the author line is missing', () => {
    expect(() => parseKindleNotebook(['1', 'Some Title', 'no author here'])).toThrow(/author/i);
  });

  it('does not mistake footer digits or summary lines for chapters', () => {
    const notebook = parseKindleNotebook(
      notebookLines([
        'Introduction',
        'Page 4 | Underline (Default)',
        'First highlight.',
        'Aug 13, 2026',
        '2',
        'Page 7 | Underline (Default)',
        'Second highlight.',
        'Aug 13, 2026',
      ]),
    );
    expect(notebook.highlights.every((h) => h.chapter === 'Introduction')).toBe(true);
  });

  it('tracks chapter changes and picks up headings between entries', () => {
    const notebook = parseKindleNotebook(
      notebookLines([
        'Preface',
        'Page x | Underline (Default)',
        'From the preface.',
        'Aug 13, 2026',
        'Introduction',
        'Page 4 | Underline (Default)',
        'From the introduction.',
        'Aug 13, 2026',
      ]),
    );
    expect(notebook.highlights.map((h) => h.chapter)).toEqual(['Preface', 'Introduction']);
  });

  it('drops Note entries without breaking chapter tracking', () => {
    const notebook = parseKindleNotebook(
      notebookLines([
        'Introduction',
        'Page 9 | Note',
        'Aug 13, 2026',
        'Page 9 | Underline (Default)',
        'A real highlight.',
        'Aug 13, 2026',
      ]),
    );
    expect(notebook.highlights).toHaveLength(1);
    expect(notebook.highlights[0]!.content).toBe('A real highlight.');
    expect(notebook.highlights[0]!.chapter).toBe('Introduction');
  });

  it('treats Highlight entries the same as Underline entries', () => {
    const notebook = parseKindleNotebook(
      notebookLines([
        'Introduction',
        'Page 4 | Highlight (yellow)',
        'A colored highlight.',
        'Aug 13, 2026',
      ]),
    );
    expect(notebook.highlights).toHaveLength(1);
    expect(notebook.highlights[0]!.content).toBe('A colored highlight.');
  });

  it('merges the four-entry split highlight chain (page xi example)', () => {
    const notebook = parseKindleNotebook(
      notebookLines([
        'Reflections, Ten Years Later',
        'Page xi | Underline (Default)',
        'What I understand today is that when the Stoics said that',
        'Aug 13, 2026',
        'Page xi | Underline (Default)',
        'there was an opportunity in every obstacle, what they meant',
        'Aug 13, 2026',
        'Page xi | Underline (Default)',
        'was the opportunity to practice virtue. ... To do good in the',
        'Aug 13, 2026',
        'Page xi | Underline (Default)',
        'world despite the bad that has befallen you.',
        'Aug 13, 2026',
      ]),
    );
    expect(notebook.highlights).toHaveLength(1);
    expect(notebook.highlights[0]!.content).toBe(
      'What I understand today is that when the Stoics said that there was an opportunity in every obstacle, what they meant was the opportunity to practice virtue. ... To do good in the world despite the bad that has befallen you.',
    );
    expect(notebook.highlights[0]!.location).toBe('xi');
  });

  it('does not merge across a real sentence boundary despite ambiguous trailing punctuation', () => {
    const notebook = parseKindleNotebook(
      notebookLines([
        'Reflections, Ten Years Later',
        'Page x | Underline (Default)',
        'are hidden advantages in every situation,',
        'Aug 13, 2026',
        'Page xi | Underline (Default)',
        'What I understand today is that when the Stoics said that.',
        'Aug 13, 2026',
      ]),
    );
    expect(notebook.highlights).toHaveLength(2);
    expect(notebook.highlights[0]!.content).toBe('are hidden advantages in every situation,');
    expect(notebook.highlights[1]!.content).toBe(
      'What I understand today is that when the Stoics said that.',
    );
  });
});

describe('mergeSplitHighlights', () => {
  const base: Omit<KindleHighlight, 'content' | 'location'> = {
    bookTitle: 'Book',
    author: 'Author',
    chapter: 'Chapter',
  };

  it('keeps the first entry location on merge', () => {
    const merged = mergeSplitHighlights([
      { ...base, location: '4', content: 'this is split across' },
      { ...base, location: '5', content: 'a page break.' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.location).toBe('4');
    expect(merged[0]!.content).toBe('this is split across a page break.');
  });
});
