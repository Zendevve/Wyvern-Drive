'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createDiscordWebhookStorage } = require('../src/storage/discord-webhook-storage');
const { loadConfig } = require('../src/config');
const { createFakeDiscordStorage } = require('./helpers');

// The adapter contract the file service depends on (documented in
// discord-webhook-storage.js): every adapter must expose the same method set
// and the same capabilities so the in-memory test fake and the webhook
// adapter stay interchangeable. Test-only knobs on the fake (failure
// injection, message inspection helpers) are not part of the contract.
const CONTRACT_METHODS = ['validateAndSealWebhook', 'putChunks', 'putChunk', 'getChunk', 'deleteChunk'];

function createRealAdapter() {
  const config = loadConfig({ ...process.env });
  return createDiscordWebhookStorage(config, { chunkSizeBytes: config.chunkSizeBytes });
}

test('webhook adapter exposes the documented method set and capabilities', () => {
  const adapter = createRealAdapter();
  for (const name of CONTRACT_METHODS) {
    assert.strictEqual(typeof adapter[name], 'function', `missing contract method ${name}`);
  }
  assert.deepStrictEqual(adapter.capabilities, { versioning: false, presignedUrls: false });
});

test('fake storage exposes the identical method set and capabilities', () => {
  const adapter = createFakeDiscordStorage();
  for (const name of CONTRACT_METHODS) {
    assert.strictEqual(typeof adapter[name], 'function', `missing contract method ${name}`);
  }
  assert.deepStrictEqual(adapter.capabilities, { versioning: false, presignedUrls: false });
});

test('fake and webhook adapters stay interchangeable: identical contract surface', () => {
  const real = createRealAdapter();
  const fake = createFakeDiscordStorage();
  const contractKeys = (adapter) => CONTRACT_METHODS.filter((name) => typeof adapter[name] === 'function').sort();
  assert.deepStrictEqual(contractKeys(fake), contractKeys(real), 'contract method set must match');
  assert.deepStrictEqual(fake.capabilities, real.capabilities, 'capabilities must match');
});
