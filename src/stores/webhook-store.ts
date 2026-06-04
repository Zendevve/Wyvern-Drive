import { create } from 'zustand';
import { validateWebhook } from '../lib/discord';

const WEBHOOK_URL_KEY = 'wyvern-webhook-url';

interface WebhookState {
  webhookUrl: string;
  status: 'unknown' | 'valid' | 'invalid';
  loadWebhook: () => void;
  setWebhookUrl: (url: string) => Promise<void>;
  validate: () => Promise<boolean>;
}

export const useWebhookStore = create<WebhookState>((set, get) => ({
  webhookUrl: '',
  status: 'unknown',

  loadWebhook: () => {
    const stored = localStorage.getItem(WEBHOOK_URL_KEY);
    const envUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL || '';
    const activeUrl = stored || envUrl;
    set({ webhookUrl: activeUrl });
    if (activeUrl) {
      get().validate();
    }
  },

  setWebhookUrl: async (url: string) => {
    localStorage.setItem(WEBHOOK_URL_KEY, url);
    set({ webhookUrl: url, status: 'unknown' });
    await get().validate();
  },

  validate: async () => {
    const url = get().webhookUrl;
    if (!url) {
      set({ status: 'invalid' });
      return false;
    }
    const isValid = await validateWebhook(url);
    const status = isValid ? 'valid' : 'invalid';
    set({ status });
    return isValid;
  },
}));
