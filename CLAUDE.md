# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run CLI with tsx watch; reloads on any change under `src/`
- `npm run build` — type-check and compile `src/` to `dist/` via `tsc`
- `npm start` — run compiled output (`dist/cli.js`); requires `npm run build` first
- `npm run lint` / `npm run lint:fix` — ESLint over `src/` (flat config, typescript-eslint)
- `npm run format` / `npm run format:check` — Prettier over `src/**/*.ts`

No test runner is configured yet.

## Architecture

Pipeline CLI (`src/cli.ts` is the entry point) that converts Kindle highlights into Notion-ready output, in three stages mapped to three modules:

- `src/kindle/` — parses Kindle's `My Clippings.txt` export into structured highlights (`kindle-parser.ts`), typed via `kindle.schema.ts` (`KindleHighlight` interface). This is the canonical data shape passed downstream.
- `src/pdf/pdf-parser.ts` — alternate input path for extracting content from PDF sources.
- `src/markdown/markdown-generator.ts` — takes `KindleHighlight[]` and produces Markdown output.

Data flows: raw input file (from `input/`) → parsed into `KindleHighlight[]` → rendered to Markdown → written to `output/`. `input/` and `output/` are gitignored data directories, not source.

Module resolution is `NodeNext` (ESM) — intra-project imports must use explicit `.js` extensions even though source files are `.ts` (e.g. `import type { KindleHighlight } from '../kindle/kindle.schema.js'`).

All current module files (`pdf-parser.ts`, `kindle-parser.ts`, `markdown-generator.ts`) are stubs that throw `Not implemented` — none of the pipeline logic is built yet.
