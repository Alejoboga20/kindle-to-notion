import { readFile } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Extracts the raw text layer of a PDF as a flat array of trimmed, non-empty lines,
 * preserving line order across the whole document (pages merged).
 */
export async function extractPdfLines(filePath: string): Promise<string[]> {
  const buffer = await readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error(`No extractable text in "${filePath}" (image-only scan?)`);
  }

  return lines;
}
