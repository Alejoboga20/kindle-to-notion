import type { Client, BlockObjectRequest } from '@notionhq/client';
import { chunkBlocks, NOTION_MAX_BLOCKS_PER_REQUEST } from './markdown-to-blocks.js';

async function resolveTitleProperty(
  client: Client,
  databaseId: string,
): Promise<{ dataSourceId: string; titleProperty: string }> {
  const database = await client.databases.retrieve({ database_id: databaseId });
  if (!('data_sources' in database)) {
    throw new Error(
      `Notion database ${databaseId} response missing data_sources (partial access?)`,
    );
  }
  const dataSourceId = database.data_sources[0]?.id;
  if (!dataSourceId) {
    throw new Error(`Notion database ${databaseId} has no data source`);
  }

  const dataSource = await client.dataSources.retrieve({ data_source_id: dataSourceId });
  const titleProperty = Object.entries(dataSource.properties).find(
    ([, config]) => config.type === 'title',
  )?.[0];
  if (!titleProperty) {
    throw new Error(`Notion data source ${dataSourceId} has no title property`);
  }

  return { dataSourceId, titleProperty };
}

async function findExistingPage(
  client: Client,
  dataSourceId: string,
  titleProperty: string,
  bookTitle: string,
): Promise<string | undefined> {
  const results = await client.dataSources.query({
    data_source_id: dataSourceId,
    filter: { property: titleProperty, title: { equals: bookTitle } },
  });

  return results.results[0]?.id;
}

/** Deletes every top-level block under a page, so it can be repopulated from scratch. */
async function clearPageContent(client: Client, pageId: string): Promise<void> {
  let cursor: string | undefined;
  const blockIds: string[] = [];
  do {
    const page = await client.blocks.children.list({ block_id: pageId, start_cursor: cursor });
    blockIds.push(...page.results.map((block) => block.id));
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);

  for (const blockId of blockIds) {
    await client.blocks.delete({ block_id: blockId });
  }
}

async function appendBlocksInChunks(
  client: Client,
  pageId: string,
  blocks: BlockObjectRequest[],
): Promise<void> {
  for (const chunk of chunkBlocks(blocks, NOTION_MAX_BLOCKS_PER_REQUEST)) {
    await client.blocks.children.append({ block_id: pageId, children: chunk });
  }
}

/**
 * Creates a Notion page for one book under the given database and appends
 * its highlight blocks. If a page with the same title already exists in the
 * database, its content is cleared and replaced in place (same page, same
 * URL/ID), so re-running the CLI on the same `input/` updates rather than
 * duplicates.
 */
export async function uploadHighlightsToNotion(
  client: Client,
  parentDatabaseId: string,
  bookTitle: string,
  blocks: BlockObjectRequest[],
): Promise<string> {
  const { dataSourceId, titleProperty } = await resolveTitleProperty(client, parentDatabaseId);

  const existingPageId = await findExistingPage(client, dataSourceId, titleProperty, bookTitle);
  if (existingPageId) {
    console.log(`updating existing Notion page for "${bookTitle}" (${existingPageId})`);
    await clearPageContent(client, existingPageId);
    await appendBlocksInChunks(client, existingPageId, blocks);

    return existingPageId;
  }

  const [firstChunk, ...remainingChunks] = chunkBlocks(blocks, NOTION_MAX_BLOCKS_PER_REQUEST);

  const page = await client.pages.create({
    parent: { database_id: parentDatabaseId },
    properties: {
      [titleProperty]: { title: [{ type: 'text', text: { content: bookTitle } }] },
    },
    children: firstChunk ?? [],
  });

  for (const chunk of remainingChunks) {
    await client.blocks.children.append({ block_id: page.id, children: chunk });
  }

  return page.id;
}
