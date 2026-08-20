import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import type { Client } from '@notionhq/client';
import { extractPdfLines } from './pdf/pdf-parser.js';
import { parseKindleNotebook } from './kindle/kindle-parser.js';
import { generateMarkdown } from './markdown/markdown-generator.js';
import { createNotionClient } from './notion/notion-client.js';
import { buildNotionBlocks } from './notion/markdown-to-blocks.js';
import { uploadHighlightsToNotion } from './notion/notion-uploader.js';

const INPUT_DIR = 'input';
const OUTPUT_DIR = 'output';

const NOTION_API_KEY = process.env['NOTION_API_KEY'];
const NOTION_PARENT_DATABASE_ID = process.env['NOTION_PARENT_DATABASE_ID'];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function processFile(
  fileName: string,
  notionClient: Client,
  notionDatabaseId: string,
): Promise<void> {
  const filePath = path.join(INPUT_DIR, fileName);
  const lines = await extractPdfLines(filePath);
  const notebook = parseKindleNotebook(lines);
  const markdown = generateMarkdown(notebook.highlights);

  const chapters = new Set(notebook.highlights.map((h) => h.chapter));
  const outputPath = path.join(OUTPUT_DIR, `${slugify(notebook.bookTitle)}.md`);
  await writeFile(outputPath, markdown, 'utf-8');

  console.log(
    `ok  ${notebook.bookTitle} -> ${outputPath} (${notebook.highlights.length} highlights, ${chapters.size} chapters)`,
  );

  const blocks = buildNotionBlocks(notebook.highlights);
  const pageId = await uploadHighlightsToNotion(
    notionClient,
    notionDatabaseId,
    notebook.bookTitle,
    blocks,
  );
  console.log(`ok  ${notebook.bookTitle} -> Notion page ${pageId}`);
}

async function main(): Promise<void> {
  console.log('kindle-to-notion CLI');

  if (!NOTION_API_KEY || !NOTION_PARENT_DATABASE_ID) {
    console.error('missing NOTION_API_KEY or NOTION_PARENT_DATABASE_ID in environment');
    process.exitCode = 1;

    return;
  }
  const notionClient = createNotionClient(NOTION_API_KEY);

  const entries = await readdir(INPUT_DIR);
  const pdfFiles = entries.filter((entry) => entry.toLocaleLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.log(`no PDFs in ${INPUT_DIR}/ directory`);

    return;
  }

  console.log(`found ${pdfFiles.length} PDF(s) in ${INPUT_DIR}/`);

  let failures = 0;

  for (const fileName of pdfFiles) {
    try {
      await processFile(fileName, notionClient, NOTION_PARENT_DATABASE_ID);
    } catch (error) {
      failures++;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ERR ${fileName}: ${message}`);
    }
  }

  const okCount = pdfFiles.length - failures;
  console.log(`done: ${okCount} ok, ${failures} failed`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

await main();
