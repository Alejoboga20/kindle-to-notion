# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run CLI with tsx watch; reloads on any change under `src/`
- `npm run build` — type-check and compile `src/` to `dist/` via `tsc`
- `npm start` — run compiled output (`dist/cli.js`); requires `npm run build` first
- `npm run lint` / `npm run lint:fix` — ESLint over `src/` (flat config, typescript-eslint)
- `npm run format` / `npm run format:check` — Prettier over `src/**/*.ts`
- `npm test` — run the Vitest suite (`*.test.ts` files under `src/`, excluded from the `tsc` build output)

## Architecture

Pipeline CLI (`src/cli.ts` is the entry point) that batches every `.pdf` in `input/` through three stages mapped to three modules, writing one Markdown file per book to `output/`:

- `src/pdf/pdf-parser.ts` — `extractPdfLines()` extracts a Kindle "Notebook" PDF export's text layer (via `unpdf`) into a flat array of trimmed, non-empty lines. Text extraction only; no structural parsing.
- `src/kindle/` — `kindle-parser.ts` owns all structural parsing: header block (title/author), a line-based state machine over annotation entries (tracking the current chapter heading), noise filtering (footer page numbers, preview links, annotation-summary lines), dropping `Note` entries, and merging highlights split across a page break (punctuation/casing heuristic — see `docs/pdf-to-markdown-plan.md`). `kindle.schema.ts` defines `KindleHighlight`/`KindleNotebook` as Zod schemas (with inferred types) — `chapter` is the grouping key, `location` is the `Page <label>` string (may be roman numerals). This module is the single place that understands the `KindleHighlight` shape, regardless of input source (PDF today, `My Clippings.txt` potentially later).
- `src/markdown/markdown-generator.ts` — takes `KindleHighlight[]` and produces Markdown, grouped by `chapter` in first-seen order.

Data flows: `input/*.pdf` → `extractPdfLines` → `parseKindleNotebook` → `generateMarkdown` → `output/<slugified-title>.md`. `input/` and `output/` are gitignored data directories, not source. Each file is processed independently (`try`/`catch` in `cli.ts`) so one malformed PDF doesn't abort the batch.

Module resolution is `NodeNext` (ESM) — intra-project imports must use explicit `.js` extensions even though source files are `.ts` (e.g. `import type { KindleHighlight } from '../kindle/kindle.schema.js'`).
