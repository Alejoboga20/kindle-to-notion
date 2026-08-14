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

1. Export your Kindle highlights/notes as a PDF.
2. Drop the PDF into `input/`.
3. Run the local script to parse it and generate a Markdown file in `output/`.
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

Place your exported Kindle PDF in `input/`, then run the CLI in dev mode (auto-reloads on changes to `src/`):

```bash
npm run dev
```

Or build and run the compiled version:

```bash
npm run build
npm start
```

Output Markdown is written to `output/`.

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

## Project structure

```
kindle-to-notion/
├── src/
│   ├── cli.ts                        # entry point
│   ├── pdf/
│   │   └── pdf-parser.ts             # parses Kindle PDF export
│   ├── kindle/
│   │   ├── kindle-parser.ts          # parses raw input into highlights
│   │   └── kindle.schema.ts          # shared KindleHighlight type
│   └── markdown/
│       └── markdown-generator.ts     # renders highlights to Markdown
├── input/                            # drop Kindle exports here (gitignored)
├── output/                           # generated Markdown lands here (gitignored)
└── package.json
```

## Status

Early stage — pipeline scaffolding is in place, but parsing/generation logic is not yet implemented.
