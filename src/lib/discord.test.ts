import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { isCdnExpired } from './discord';

const server = setupServer(
  http.post('https://discord.com/api/v10/webhooks/:id/:token', () => {
    return HttpResponse.json({ id: 'msg-1', channel_id: 'ch-1', content: '', attachments: [] });
  }),
  http.get('https://discord.com/api/v10/webhooks/:id/:token/messages/:msgId', () => {
    return HttpResponse.json({
      id: 'msg-1',
      channel_id: 'ch-1',
      content: '',
      attachments: [{
        id: 'att-1',
        filename: 'chunk_0.bin',
        size: 1024,
        url: 'https://cdn.discordapp.com/attachments/test?ex=ffffffff',
        content_type: 'application/octet-stream',
      }],
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('discord', () => {
  describe('isCdnExpired', () => {
    it('returns false for non-expired URL', () => {
      const futureHex = Math.floor(Date.now() / 1000 + 3600).toString(16);
      expect(isCdnExpired(`https://cdn.discordapp.com/test?ex=${futureHex}`)).toBe(false);
    });

    it('returns true for expired URL', () => {
      const pastHex = Math.floor(Date.now() / 1000 - 3600).toString(16);
      expect(isCdnExpired(`https://cdn.discordapp.com/test?ex=${pastHex}`)).toBe(true);
    });

    it('returns false for URL without expiry parameter', () => {
      expect(isCdnExpired('https://cdn.discordapp.com/test')).toBe(false);
    });
  });
});
