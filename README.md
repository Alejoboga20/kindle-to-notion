# kindle-to-notion

Get Kindle highlights and notes into Notion with minimal friction.

## Problem

When I finish a book, I want all my Kindle highlights and notes organized in Notion — without manually retyping or reformatting them.

## Current flow

This project starts with a simple, manual pipeline. It will evolve into something more automated over time.

```
Kindle
  ↓ export
PDF
  ↓
local script
  ↓
Markdown (output/)
  ↓
Notion API
Notion
```

1. Export your Kindle highlights/notes as a PDF (Kindle's "Notebook" export).
2. Drop one or more PDFs into `input/`.
3. Run the local script — each PDF is parsed independently, turned into a Markdown file in `output/` (highlights grouped by chapter), and uploaded to Notion as one page per book.

Future iterations may parse Kindle's `My Clippings.txt` directly.

### Notion setup

1. Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations), copy its internal integration token.
2. Pick or create a Notion database to hold your books (one page per book).
3. Share that database with the integration: open it in Notion → `···` menu → **Connections** → add your integration. Without this step, API calls will 404 even with a valid token.
4. Copy the database ID from its URL — the 32-character id right before any `?v=` view-id suffix (don't include the `?v=...` part).
5. Copy `.env.example` to `.env` and fill in:
   ```
   NOTION_API_KEY=<your integration token>
   NOTION_PARENT_DATABASE_ID=<your database id>
   ```

Re-running the CLI on the same `input/` skips books that already have a page in the database (matched by title), so it won't create duplicates.

## Requirements

- Node.js (LTS recommended)
- npm

## Setup

```bash
npm install
```

## Usage

Place one or more exported Kindle PDFs in `input/`, then run the CLI in dev mode (auto-reloads on changes to `src/`):

```bash
npm run dev
```

Or build and run the compiled version:

```bash
npm run build
npm start
```

Every `.pdf` in `input/` is processed; a malformed file is skipped with an error logged, so it doesn't stop the rest of the batch. Each book's Markdown is written to `output/<slugified-title>.md`, e.g.:

```markdown
# The Obstacle is the Way

*by Holiday, Ryan*

## Introduction
- (Page 4) Turn it around. Find some benefit. Use it as fuel.
```

## Scripts

| Command                | Description                                              |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Run the CLI with `tsx watch`, reloading on `src/` changes |
| `npm run build`         | Type-check and compile `src/` to `dist/`                  |
| `npm start`             | Run the compiled CLI from `dist/`                          |
| `npm run lint`          | Lint `src/` with ESLint                                    |
| `npm run lint:fix`      | Lint and auto-fix                                          |
| `npm run format`        | Format `src/` with Prettier                                 |
| `npm run format:check`  | Check formatting without writing changes                    |
| `npm test`               | Run the Vitest test suite                                    |

## Project structure

```
kindle-to-notion/
├── src/
│   ├── cli.ts                        # entry point — batches input/*.pdf to output/*.md
│   ├── pdf/
│   │   └── pdf-parser.ts             # extracts raw text lines from a Kindle PDF export
│   ├── kindle/
│   │   ├── kindle-parser.ts          # parses lines into highlights: chapters, page-break merges, notes dropped
│   │   └── kindle.schema.ts          # KindleHighlight / KindleNotebook Zod schemas
│   ├── markdown/
│   │   └── markdown-generator.ts     # renders highlights to Markdown, grouped by chapter
│   └── notion/
│       ├── notion-client.ts          # Notion SDK client factory
│       ├── markdown-to-blocks.ts     # KindleHighlight[] -> Notion block objects, 100-block chunking
│       └── notion-uploader.ts        # creates/skips a Notion page per book, appends blocks
├── input/                            # drop Kindle exports here (gitignored)
├── output/                           # generated Markdown lands here (gitignored)
└── package.json
```

## Status

PDF → Markdown → Notion pipeline is implemented and working end-to-end. Not yet built: `My Clippings.txt` input, two-way sync, updating an already-uploaded page's content on re-run.
