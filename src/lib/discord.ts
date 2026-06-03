import { RateLimiter, DiscordRateLimitError, DiscordApiError } from './rate-limiter';

const API_VERSION = 'v10';
const BASE_URL = `https://discord.com/api/${API_VERSION}`;
const CDN_BUFFER_MS = 5 * 60 * 1000;

export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  content_type: string;
}

export interface DiscordMessageResponse {
  id: string;
  channel_id: string;
  content: string;
  attachments: DiscordAttachment[];
}

const limiter = new RateLimiter();

function extractWebhookParts(webhookUrl: string): { id: string; token: string } {
  const match = webhookUrl.match(/\/webhooks\/(\d+)\/([^/?]+)/);
  if (!match) throw new Error('Invalid webhook URL');
  return { id: match[1], token: match[2] };
}

function parseCdnExpiry(url: string): Date | null {
  const expiryMatch = url.match(/[?&]ex=([a-f0-9]+)/i);
  if (!expiryMatch) return null;
  const timestamp = parseInt(expiryMatch[1], 16);
  return new Date(timestamp * 1000);
}

export async function validateWebhook(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Wyvern Drive connection test' }),
    });
    if (response.status === 429) {
      const body = await response.json();
      throw new DiscordRateLimitError(body.retry_after || 1);
    }
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}

export async function uploadChunk(
  webhookUrl: string,
  file: Blob,
  metadata: Record<string, unknown>
): Promise<DiscordMessageResponse> {
  return limiter.enqueue(async () => {
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify({
      content: JSON.stringify(metadata),
    }));
    formData.append('files[0]', file, `chunk_${metadata.chunkIndex}.bin`);

    const response = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      body: formData,
    });

    if (response.status === 429) {
      const body = await response.json();
      throw new DiscordRateLimitError(body.retry_after || 1);
    }
    if (!response.ok) {
      throw new DiscordApiError(response.status, `Upload failed: ${response.statusText}`);
    }

    return response.json();
  });
}

export async function fetchMessage(
  webhookUrl: string,
  messageId: string
): Promise<DiscordMessageResponse> {
  const { id, token } = extractWebhookParts(webhookUrl);
  return limiter.enqueue(async () => {
    const url = `${BASE_URL}/webhooks/${id}/${token}/messages/${messageId}`;
    const response = await fetch(url);
    if (response.status === 429) {
      const body = await response.json();
      throw new DiscordRateLimitError(body.retry_after || 1);
    }
    if (!response.ok) {
      throw new DiscordApiError(response.status, `Fetch failed: ${response.statusText}`);
    }
    return response.json();
  });
}

export async function refreshCdnUrl(
  webhookUrl: string,
  messageId: string
): Promise<string> {
  const message = await fetchMessage(webhookUrl, messageId);
  if (message.attachments.length === 0) {
    throw new Error('No attachments in message');
  }
  return message.attachments[0].url;
}

export function isCdnExpired(url: string): boolean {
  const expiry = parseCdnExpiry(url);
  if (!expiry) return false;
  return Date.now() > expiry.getTime() - CDN_BUFFER_MS;
}
