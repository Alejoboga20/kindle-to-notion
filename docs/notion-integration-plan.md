# Implementation Plan: Markdown → Notion

Goal: add one more pipeline step after Markdown generation — push generated Markdown file to Notion as page. No change to PDF/Markdown stages.

## Current pipeline (unchanged)

```
input/*.pdf → extractPdfLines → parseKindleNotebook → generateMarkdown → output/<slug>.md
```

## New pipeline

```
input/*.pdf → extractPdfLines → parseKindleNotebook → generateMarkdown → output/<slug>.md → uploadToNotion
```

`uploadToNotion` new step in `cli.ts`, after Markdown file write, inside same per-file `try`/`catch` — one book failing Notion upload must not abort batch, matches existing behavior.

## Notion prerequisites (manual, one-time, user-side)

1. Create Notion integration at notion.so/my-integrations, grab internal integration token (`ntn_...` or legacy `secret_...`).
2. Pick or create parent — either a Notion database (recommended, one row per book) or a parent page (one sub-page per book).
3. Share that database/page with integration (`···` menu → Connections → add integration). Without this, API calls 404 even with valid token.
4. Grab `database_id` or `page_id` from URL.

Document these steps in README setup section once implemented.

## Config

Add `.env` (gitignored, add `.env.example`):

```
NOTION_API_KEY=
NOTION_PARENT_DATABASE_ID=
```

Add `dotenv` dependency, load at top of `cli.ts`. Fail fast with clear error at startup if `NOTION_API_KEY` or `NOTION_PARENT_DATABASE_ID` missing — don't fail per-file, fail whole run before processing starts, since it's a config problem not a data problem.

## Libraries to add

- `@notionhq/client` — official Notion SDK, typed, ESM-friendly.
- `dotenv` — env var loading.
- Markdown → Notion blocks conversion: hand-roll a small mapper (see below) rather than pulling a library — output Markdown shape is narrow and fully controlled by our own `markdown-generator.ts` (H1 title, italic byline, H2 chapters, bullet list items only). A generic Markdown-to-Notion-blocks library (e.g. `martian`) is a fallback if hand-rolled mapper gets unwieldy, not the starting choice.

## New module: `src/notion/notion-client.ts`

Thin wrapper around `@notionhq/client`:

- `createNotionClient(apiKey: string): Client` — instantiate SDK client.
- Own all direct Notion API calls (page creation, block append). Single place that understands Notion API shape, mirrors how `kindle-parser.ts` is the single place that understands `KindleHighlight` shape.

## New module: `src/notion/markdown-to-blocks.ts`

Convert `KindleHighlight[]` (already in hand from `kindle-parser.ts` — reuse the structured data, not the rendered Markdown string, so no re-parsing of Markdown is needed) directly into Notion block objects:

- `bookTitle` → not a block; used as the new page's `title` property instead.
- `author` → one paragraph block, italic rich-text, e.g. "by Holiday, Ryan".
- Each distinct `chapter` (first-seen order, same grouping already used by `markdown-generator.ts`) → one `heading_2` block.
- Each highlight under a chapter → one `bulleted_list_item` block, rich-text content `(Page <label>) <content>`.

Function signature: `buildNotionBlocks(highlights: KindleHighlight[]): BlockObjectRequest[]`.

Note: Notion API caps 100 blocks per single page-creation/append call. Kindle notebook exports can exceed this easily. Must batch: create page with first ≤100 blocks, then loop `blocks.children.append` for remaining blocks in chunks of 100.

## New module: `src/notion/notion-uploader.ts`

Orchestrates the upload for one book:

- `uploadHighlightsToNotion(client: Client, parentDatabaseId: string, bookTitle: string, author: string, blocks: BlockObjectRequest[]): Promise<string>` — creates page under parent database with title property set to `bookTitle`, appends blocks in ≤100 chunks, returns created page URL/ID.
- Duplicate handling: before creating, query parent database for existing page with matching title property (Notion API `databases.query` with filter). If found, either skip with warning log or archive+recreate — decide behavior explicitly (recommend: skip + log warning, so re-running CLI on same `input/` doesn't spam duplicate Notion pages).

## Wiring into `cli.ts`

After existing `writeFile` step for a book's Markdown:

```
const highlights = parseKindleNotebook(lines);
const markdown = generateMarkdown(highlights);
await writeFile(outputPath, markdown);

const blocks = buildNotionBlocks(highlights);
const pageUrl = await uploadHighlightsToNotion(notionClient, parentDatabaseId, highlights[0].bookTitle, highlights[0].author, blocks);
console.log(`Uploaded to Notion: ${pageUrl}`);
```

Stays inside existing per-file `try`/`catch` — Notion failure (auth, rate limit, network) logs error for that book, batch continues to next PDF. Markdown file is already written to `output/` regardless, so no data loss even if Notion step fails — local Markdown remains source of truth on failure.

## Error handling specifics

- 401 — bad/missing API key → this is a startup-time config check (see Config section), shouldn't reach here.
- 404 — parent database/page not shared with integration → surface actionable error message pointing at the "share with integration" step.
- 429 — rate limited → `@notionhq/client` doesn't auto-retry; either wrap calls with simple retry-with-backoff or let it fail per-file (batch continues, user reruns later). Given batch sizes here (few books at a time), simple retry-with-backoff (e.g. 3 attempts, exponential) is enough; no need for a queue.

## Steps

1. Add `@notionhq/client` and `dotenv` dependencies.
2. Add `.env.example`, update `.gitignore` if `.env` not already covered.
3. Write manual Notion-side setup steps into README (integration creation, sharing database/page, `database_id`).
4. Implement `src/notion/notion-client.ts` — client factory.
5. Implement `src/notion/markdown-to-blocks.ts` — `KindleHighlight[]` → Notion block objects, with 100-block chunking helper.
6. Implement `src/notion/notion-uploader.ts` — page creation + block append + duplicate-title check.
7. Wire into `cli.ts`: load env/config at startup (fail fast if missing), instantiate Notion client once, call uploader per book inside existing `try`/`catch`.
8. Update README: pipeline diagram (drop "manual copy/paste", add "Notion API"), setup section, status section.
9. Tests: unit test `markdown-to-blocks.ts` (pure function, easy to test — chapter grouping, block count, chunking at 100-item boundary) with Vitest. Mock `@notionhq/client` for `notion-uploader.ts` tests (no live API calls in test suite).
10. Validate end-to-end against a real Notion workspace/integration (manual, not automated) using the existing example PDF.

## Out of scope for this iteration

- Two-way sync (editing in Notion reflected back).
- Updating an existing Notion page's content on re-run (only skip-if-exists, no diffing/merging highlights into an already-uploaded page).
- Notes (still dropped upstream in `kindle-parser.ts`, unchanged).
- Choosing between "one database, one row per book" vs. "one parent page, one sub-page per book" is left as a config-time decision (`NOTION_PARENT_DATABASE_ID` assumes database; page-parent variant would use `pages.create` with `parent: { page_id }` instead — not both supported in first iteration).
