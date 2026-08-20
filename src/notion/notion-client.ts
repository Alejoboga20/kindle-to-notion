import { Client } from '@notionhq/client';

export function createNotionClient(apiKey: string): Client {
  return new Client({ auth: apiKey });
}
