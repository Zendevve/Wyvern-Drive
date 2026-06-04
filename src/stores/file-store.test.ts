import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore, setWebhookUrl, getWebhookUrl } from './file-store';

describe('file-store', () => {
  beforeEach(() => {
    localStorage.clear();
    useFileStore.setState({ files: [], currentFolderId: null, isLoading: false });
  });

  it('setWebhookUrl stores in localStorage', () => {
    setWebhookUrl('https://discord.com/api/webhooks/123/abc');
    expect(getWebhookUrl()).toBe('https://discord.com/api/webhooks/123/abc');
  });

  it('getWebhookUrl returns null when not set', () => {
    expect(getWebhookUrl()).toBeNull();
  });

  it('setCurrentFolder updates state', () => {
    useFileStore.getState().setCurrentFolder('folder-123');
    expect(useFileStore.getState().currentFolderId).toBe('folder-123');
  });

  it('setCurrentFolder to null resets folder', () => {
    useFileStore.getState().setCurrentFolder('folder-123');
    useFileStore.getState().setCurrentFolder(null);
    expect(useFileStore.getState().currentFolderId).toBeNull();
  });

  it('starts with empty files array', () => {
    expect(useFileStore.getState().files).toEqual([]);
  });

  it('starts with isLoading false', () => {
    expect(useFileStore.getState().isLoading).toBe(false);
  });
});
