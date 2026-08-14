# Implementation Plan: PDF → Markdown

Goal: parse a Kindle-exported "Notebook" PDF (highlights/notes export) and produce a Markdown file with the book's title, author, and its underlines/highlights grouped by chapter/section. Notes are ignored for now.

## Reference example

`examples/Notebook - The Obstacle is the Way Expanded 10th Anniversary Edition-2026-08-13-15-47.pdf`

This file defines the structure we assume all future input PDFs will follow.

## Observed structure (from the example)

The raw text layer of the PDF looks like this, in order:

```
<page-number>                              <- PDF page footer number, not a book page, ignore
<Book Title>
by <Author>                                 <- e.g. "by Holiday, Ryan"
Free Kindle instant preview: <url>          <- ignore
Annotations (<n>)
 • <n> Underlines | Default (<n>)
 • <n> Note                                 <- summary counts, ignore
<Chapter/Section heading>                   <- e.g. "Reflections, Ten Years Later", "Preface"

Page <label> | Underline (Default)
<highlight text, may wrap across 1+ lines>

<Month DD, YYYY>                            <- annotation date, closes the entry

Page <label> | Underline (Default)
<highlight text>

<Month DD, YYYY>

Page <label> | Note                         <- note entries have NO text line before the date
<Month DD, YYYY>

<next Chapter/Section heading>
Page <label> | Underline (Default)
...
```

Key details that matter for parsing:

- **Title/Author** appear once, near the top: title is the line right after the leading page-number line; author is the line starting with `by `.
- **Page label** is not always numeric — front matter uses roman numerals (`x`, `xi`, `xviii`) before switching to arabic numbers (`4`, `7`, `9`). Treat it as a string, not an int.
- **Entry type** is given on the header line: `Underline (Default)` or `Note`. There may also be colored `Highlight (<color>)` entries per Kindle's export format — treat `Underline` and `Highlight` the same way (both are content we keep); `Note` is excluded per current scope.
- **Note entries have no highlight text.** The line after `Page X | Note` goes straight to the date line — this is how we distinguish them from underlines without needing an image/drawing parser.
- **A highlight's text can wrap across multiple lines within one entry** (word wrap, still the same `Page X | Underline` block) — join those lines with a space.
- **A single highlight can also be split across two or more separate `Page X | Underline` entries**, each with its own date line, when the underlined passage crosses a page break. This must **not** be detected by date/proximity (a shared or adjacent date does not imply continuation — unrelated entries can share a date too). Instead, use a punctuation/casing heuristic after parsing: if one entry's text does not end with sentence-ending punctuation (`.`, `!`, `?`, closing quote) and the next entry's text starts with a lowercase letter, treat them as one continuous highlight and merge (see step 5). Example from the sample PDF, page `xi`: four consecutive entries — "What I understand today is that when the Stoics said that" / "there was an opportunity in every obstacle, what they meant" / "was the opportunity to practice virtue. ... To do good in the" / "world despite the bad that has befallen you." — are really one highlight and must be joined into a single sentence.
- **Chapter/section headings** are plain lines that appear between a date line and the next `Page X | ...` header. They are the grouping key for the output, so they must be recognized and tracked (not skipped) — every entry belongs to whichever heading most recently preceded it.
- PDF footer page numbers (the lone digit at the top of each extracted page) are unrelated to the book's `Page <label>` and must not be confused with it.

## Data model

Reuse and slightly repurpose the existing schema in `src/kindle/kindle.schema.ts`:

```ts
export interface KindleHighlight {
  bookTitle: string;
  author: string;
  chapter: string; // the chapter/section heading in effect, e.g. "Introduction"
  location: string; // the "Page <label>" value, e.g. "xi", "9" — kept for context, not the grouping key
  content: string;
}
```

`location` already fits the "page" concept and is kept as extra context on each entry, but it is no longer the grouping key — `chapter` is new and is what the Markdown generator groups by. If `Highlight` support or color/type ever needs to be surfaced, add an optional `type: 'underline' | 'highlight'` field later; not needed for the current scope.

## Steps

1. **Pick a PDF text-extraction library.**
   The project is ESM (`"type": "module"`, `moduleResolution: NodeNext`), so favor a library that plays well with that:
   - `pdfjs-dist` — Mozilla's engine, used under the hood by most wrappers. Gives full control over per-page text items if line-based extraction turns out to be unreliable.
   - `unpdf` — thin, ESM-first wrapper around `pdfjs-dist`, simpler API (`getDocumentText`), no CJS interop friction. Good default choice for this project.
   - `pdf-parse` — the most common wrapper, but it's CJS and has had ESM-interop rough edges; only fall back to it if `unpdf` proves insufficient.

   Recommendation: start with `unpdf`. Fall back to `pdfjs-dist` directly if page/line structure from `unpdf`'s plain-text output turns out to be lossy.

2. **Extract raw text.**
   Load the PDF, extract text per PDF page, and concatenate preserving line breaks (this is what the state machine in step 3 depends on). Confirm empirically against the example file that line breaks in the extracted text match what's shown above — Kindle's notebook export is a simple single-column layout, so this should hold, but verify before building the parser around it.

3. **Parse the header block.**
   From the first few lines of the extracted text, pull:
   - `bookTitle` — line after the leading page-number line.
   - `author` — line matching `/^by (.+)$/`, capture group is the raw author string (e.g. `"Holiday, Ryan"`). No name-order normalization for now — pass it through as-is.

4. **Parse annotation entries with a line-based state machine.**
   Walk the remaining lines with a small state machine, tracking a `currentChapter` variable. Each entry stays a separate item in this step — no cross-entry merging happens here, that's step 5.
   - Line matches `/^Page\s+(\S+)\s*\|\s*(Underline|Highlight|Note)/i` → open a new entry, capture `page` and `type`, reset a text buffer.
   - While inside an open entry and the line is not a date line (`/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/`) → append the line to the text buffer (trim, join with a space — this only handles in-entry word wrap, see key details above).
   - Line matches the date pattern → close the current entry: if `type` is `Note` or the buffer is empty, discard it; otherwise push `{ chapter: currentChapter, page, content: buffer }` to the results list.
   - Any other non-empty line while *not* inside an open entry → update `currentChapter` to this line's text (this is the grouping key downstream).

5. **Merge highlights split across entries.**
   Walk the parsed entry list in order and merge adjacent entries when a highlight was split by a page break: if entry `N`'s content does not end with sentence-ending punctuation (`.`, `!`, `?`, or a closing quote) **and** entry `N+1`'s content starts with a lowercase letter, concatenate `N` and `N+1` with a single space into one entry (keep entry `N`'s `chapter`/`page`), then re-check the merged entry against `N+2`, and so on — merges can chain across more than two entries (see the four-entry `xi` example above). This heuristic — trailing punctuation + next leading case — replaces any date- or proximity-based assumption; entries sharing or neighboring a date are not, by themselves, evidence of continuation.

6. **Filter and group.**
   Keep only `Underline`/`Highlight` entries (Notes already dropped in step 4). Group the resulting (post-merge) list by `chapter`, preserving first-seen order of chapters (the order they appear in the document). Within a chapter, preserve entry order; `page` travels with each entry as extra context (using the first page of a merged highlight).

7. **Build the `KindleHighlight[]`.**
   Map each parsed entry to `{ bookTitle, author, chapter, location: page, content }` using the title/author captured in step 3.

8. **Generate Markdown** (`src/markdown/markdown-generator.ts`).
   Output shape:

   ```markdown
   # <bookTitle>

   *by <author>*

   ## <Chapter heading>
   - (Page <label>) <highlight 1>
   - (Page <label>) <highlight 2>

   ## <Next chapter heading>
   - (Page <label>) <highlight>
   ```

9. **Wire into the CLI** (`src/cli.ts`).
   Read a PDF path from `input/`, run it through `pdf-parser.ts` (extraction + entry parsing) → `kindle-parser.ts` or a shared mapping step (produces `KindleHighlight[]`) → `markdown-generator.ts` → write the result to `output/<slugified-title>.md`.

   Open question: `pdf-parser.ts` currently owns "parse the PDF," while `kindle-parser.ts` is named around parsing `My Clippings.txt`. Since this iteration's input is a PDF, decide whether the state machine and merge logic in steps 4–5 live in `pdf-parser.ts` (producing `KindleHighlight[]` directly) or whether `pdf-parser.ts` only does raw text extraction and hands lines to `kindle-parser.ts` for entry parsing/merging. Leaning toward the latter, so `kindle-parser.ts` stays the single place that understands the `KindleHighlight` shape regardless of input source (PDF today, `My Clippings.txt` potentially later).

10. **Validate against the example file.**
   Run the full pipeline against `examples/Notebook - The Obstacle is the Way Expanded 10th Anniversary Edition-2026-08-13-15-47.pdf` and confirm:
   - Title and author extracted correctly.
   - Entries group correctly into the 3 chapters: "Reflections, Ten Years Later", "Preface", "Introduction".
   - The 1 note (page 9) is excluded and doesn't break the chapter tracking around it.
   - The split-highlight heuristic correctly merges known chains, e.g.:
     - The 4-entry `xi` chain into: "What I understand today is that when the Stoics said that there was an opportunity in every obstacle, what they meant was the opportunity to practice virtue. To be a good person despite the bad things that have happened. To do good in the world despite the bad that has befallen you."
     - The 5-entry page-4 chain into one highlight ending in "...Turn it around. Find some benefit. Use it as fuel."
   - The heuristic does *not* over-merge across a real sentence boundary even when trailing punctuation alone is ambiguous: the page-`x`/`xi` entry "are hidden advantages in every situation," ends with a comma (not sentence-ending), but the next entry starts with a capitalized "What I understand today..." — capitalization blocks the merge, correctly keeping these as two separate highlights.

## Libraries to add

- `unpdf` (or `pdfjs-dist` if more control is needed) — PDF text extraction.
- No schema/validation library needed yet; the shapes are small enough for plain TypeScript interfaces. Revisit if input variability grows (e.g. `zod`).

## Out of scope for this iteration

- Notes.
- Author name normalization (`"Holiday, Ryan"` → `"Ryan Holiday"`).
- Nested/sub-heading hierarchies (only a single flat chapter/section level is assumed).
- Handling PDFs that deviate from the observed structure.
- Direct Notion API integration (still manual copy/paste per the current flow in the README).
