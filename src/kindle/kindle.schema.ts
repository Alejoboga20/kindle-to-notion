import { z } from 'zod';

export const kindleHighlightSchema = z.object({
  bookTitle: z.string().min(1),
  author: z.string().min(1),
  chapter: z.string(), // '' allowed: entries that appear before the first heading
  location: z.string().min(1), // the 'Page <label>' value, e.g. 'xi', '9' — kept as string, may be roman numerals
  content: z.string().min(1),
});
export type KindleHighlight = z.infer<typeof kindleHighlightSchema>;

export const kindleNotebookSchema = z.object({
  bookTitle: z.string().min(1),
  author: z.string().min(1),
  highlights: z.array(kindleHighlightSchema).min(1),
});
export type KindleNotebook = z.infer<typeof kindleNotebookSchema>;
