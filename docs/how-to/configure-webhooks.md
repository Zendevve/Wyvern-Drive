# How to Configure and Manage Discord Webhooks

This guide provides actionable recipes for configuring, testing, rotating, and troubleshooting Discord Webhooks in Wyvern Drive.

---

## 1. How to Test Webhook Connectivity and Latency

To verify that your configured Discord Webhook is active and measuring network roundtrip time:

1. Open **Settings** by clicking the gear icon in the bottom-left sidebar.
2. In the **Discord Storage Webhook** section, ensure your webhook URL is entered:
   ```
   https://discord.com/api/webhooks/<WEBHOOK_ID>/<WEBHOOK_TOKEN>
   ```
3. Click **Test Connection**.
4. The system executes an authenticated `GET` request to Discord's API and displays:
   - Webhook Name
   - Target Channel ID
   - Network Roundtrip Ping (in milliseconds)

---

## 2. How to Rotate or Change Your Storage Webhook

If your webhook token was compromised or you want to migrate storage to a different server channel:

1. Create a new Webhook in your target Discord server under **Server Settings → Integrations → Webhooks**.
2. Copy the new Webhook URL.
3. In Wyvern Drive, open **Settings**.
4. Paste the new Webhook URL into the input field.
5. Click **Test Connection** to confirm connectivity.
6. Click **Save Settings**.

> 💡 **Note**: Files previously uploaded will remain accessible via their direct Discord CDN attachment links stored in your local SQLite database, while all new uploads will be directed to the new channel.

---

## 3. How to Resolve Common Webhook Errors

### Error: `Discord rejected webhook (status 404)`
- **Cause**: The webhook was deleted in Discord or the Webhook ID in the URL is incorrect.
- **Resolution**: Generate a new webhook in your Discord channel and update the URL in Wyvern Drive Settings.

### Error: `Discord rejected webhook (status 401 / 403)`
- **Cause**: The token portion of the URL is invalid, or permissions were revoked on the Discord server.
- **Resolution**: Re-copy the exact Webhook URL from Discord Server Settings.

### Error: `You are being rate limited (status 429)`
- **Cause**: Discord enforces a bucket rate limit on webhooks (typically 5 requests per 2 seconds).
- **Resolution**: Wyvern Drive automatically pauses and retries using exponential backoff according to the `retry_after` header. If you encounter frequent rate limits, reduce the **Concurrent Workers** slider in Settings to `2` or `3`.
