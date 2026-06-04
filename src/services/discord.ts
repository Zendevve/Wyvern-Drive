import { REST } from '@discordjs/rest';

const rest = new REST({ version: '10' });

export interface WebhookInfo {
  id: string;
  name: string;
  avatar: string | null;
  channel_id: string;
  guild_id: string;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url: string;
  content_type?: string;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  attachments: DiscordAttachment[];
}

export function getWebhookPath(webhookUrl: string): string {
  const match = webhookUrl.match(/webhooks\/(\d+)\/([a-zA-Z0-9_\-]+)/);
  if (!match) {
    throw new Error('Invalid Discord Webhook URL');
  }
  const [, id, token] = match;
  return `/webhooks/${id}/${token}`;
}

export async function validateWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const path = getWebhookPath(webhookUrl);
    const result = await rest.get(path as `/${string}`, { auth: false }) as WebhookInfo;
    return !!(result && result.id);
  } catch (error) {
    return false;
  }
}

export async function uploadChunk(
  webhookUrl: string,
  chunkData: Buffer,
  fileName: string
): Promise<DiscordAttachment> {
  const path = getWebhookPath(webhookUrl);
  
  const response = await rest.post(path as `/${string}`, {
    query: new URLSearchParams({ wait: 'true' }),
    files: [
      {
        data: chunkData,
        name: fileName,
      },
    ],
    auth: false,
  }) as DiscordMessage;

  if (!response.attachments || response.attachments.length === 0) {
    throw new Error('Upload succeeded but no attachment was returned');
  }

  return response.attachments[0];
}

export async function deleteMessage(webhookUrl: string, messageId: string): Promise<void> {
  const path = getWebhookPath(webhookUrl);
  await rest.delete(`${path}/messages/${messageId}` as `/${string}`, {
    auth: false,
  });
}
