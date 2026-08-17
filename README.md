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
Markdown
  ↓
manual copy/paste
Notion
```

1. Export your Kindle highlights/notes as a PDF (Kindle's "Notebook" export).
2. Drop one or more PDFs into `input/`.
3. Run the local script — each PDF is parsed independently and turned into a Markdown file in `output/`, highlights grouped by chapter.
4. Copy/paste the Markdown into Notion.

This is intentionally low-tech for now. Future iterations may parse Kindle's `My Clippings.txt` directly, write to Notion via its API, or both.

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
│   └── markdown/
│       └── markdown-generator.ts     # renders highlights to Markdown, grouped by chapter
├── input/                            # drop Kindle exports here (gitignored)
├── output/                           # generated Markdown lands here (gitignored)
└── package.json
```

## Status

PDF → Markdown pipeline is implemented and working end-to-end. Not yet built: `My Clippings.txt` input, direct Notion API integration.
