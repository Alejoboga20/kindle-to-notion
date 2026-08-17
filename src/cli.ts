import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractPdfLines } from './pdf/pdf-parser.js';
import { parseKindleNotebook } from './kindle/kindle-parser.js';
import { generateMarkdown } from './markdown/markdown-generator.js';

const INPUT_DIR = 'input';
const OUTPUT_DIR = 'output';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function processFile(fileName: string): Promise<void> {
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
}

async function main(): Promise<void> {
  console.log('kindle-to-notion CLI');

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
      await processFile(fileName);
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
