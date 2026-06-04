import { describe, it, expect } from 'vitest';
import { validateWebhook, uploadChunk, deleteMessage, getWebhookPath } from '../src/services/discord';

describe('Discord Webhook Service', () => {
  const validUrl = 'https://discord.com/api/webhooks/1234567890/abc-123_xyz';
  const invalidUrl = 'https://discord.com/api/webhooks/invalid/abc-123_xyz';

  it('should parse webhook URLs correctly', () => {
    expect(getWebhookPath(validUrl)).toBe('/webhooks/1234567890/abc-123_xyz');
    expect(() => getWebhookPath('https://google.com')).toThrow();
  });

  it('should validate webhook successfully', async () => {
    const isValid = await validateWebhook(validUrl);
    expect(isValid).toBe(true);

    const isInvalid = await validateWebhook(invalidUrl);
    expect(isInvalid).toBe(false);
  });

  it('should upload a chunk successfully', async () => {
    const chunk = Buffer.from('hello world');
    const attachment = await uploadChunk(validUrl, chunk, 'test.bin');

    expect(attachment.id).toBe('att_5555555555');
    expect(attachment.filename).toBe('test.bin');
    expect(attachment.size).toBe(11);
    expect(attachment.url).toContain('test.bin');
  });

  it('should delete a message successfully', async () => {
    await expect(deleteMessage(validUrl, 'msg_9876543210')).resolves.not.toThrow();
  });
});
