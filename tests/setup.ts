import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_1234567890';

// Global mocks for @discordjs/rest
vi.mock('@discordjs/rest', () => {
  return {
    REST: vi.fn().mockImplementation(() => {
      return {
        get: vi.fn().mockImplementation(async (path: string) => {
          if (path.includes('invalid')) {
            throw new Error('Invalid Webhook');
          }
          return {
            id: '1234567890',
            name: 'Test Webhook',
            channel_id: '111111111',
            guild_id: '222222222',
          };
        }),
        post: vi.fn().mockImplementation(async (path: string, options: any) => {
          const fileName = options?.files?.[0]?.name || 'chunk-0.bin';
          return {
            id: 'msg_9876543210',
            channel_id: '111111111',
            attachments: [
              {
                id: 'att_5555555555',
                filename: fileName,
                size: options?.files?.[0]?.data?.length || 100,
                url: `https://cdn.discordapp.com/attachments/111111111/msg_9876543210/${fileName}`,
                proxy_url: `https://media.discordapp.net/attachments/111111111/msg_9876543210/${fileName}`,
              },
            ],
          };
        }),
        delete: vi.fn().mockImplementation(async () => {
          return {};
        }),
      };
    }),
  };
});

// Global mock for axios
vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn().mockImplementation(async (url: string, config: any) => {
        const { Readable } = require('stream');
        const s = new Readable();
        // Return some dummy chunk content based on the requested range or URL
        s.push('mocked chunk content');
        s.push(null);
        return {
          data: s,
          status: 200,
          headers: {},
        };
      }),
    },
  };
});
