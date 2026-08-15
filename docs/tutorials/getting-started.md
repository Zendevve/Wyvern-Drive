# Getting Started with Wyvern Drive

This tutorial guides you through setting up your first personal cloud vault with **Wyvern Drive** from start to finish. In this lesson, you will create a private Discord storage channel, configure your vault webhook, upload an encrypted file, and stream it in real time.

---

## Prerequisites
Before beginning this tutorial, ensure you have:
1. A Discord account ([discord.com](https://discord.com)).
2. The Wyvern Drive desktop application installed or built locally.

---

## Step 1: Create a Dedicated Discord Server & Channel

To store your files securely without interference from chat messages, create a private server:

1. Open your Discord desktop or web client.
2. In the left server sidebar, click the **`+` (Add a Server)** button.
3. Select **Create My Own** → **For me and my friends**.
4. Name your server (e.g., `My Private Vault`) and click **Create**.
5. Inside your new server, right-click the default `#general` text channel (or create a dedicated `#cloud-storage` channel) and click **Edit Channel**.

```
Discord Desktop
├── [ + ] Create Server
│    └── Name: "My Private Vault"
└── Channels
     └── #cloud-storage (Text Channel)
```

---

## Step 2: Generate a Storage Webhook

Webhooks provide an API endpoint to upload attachments directly to your Discord channel:

1. In your Discord server, click the server dropdown menu (top-left) and choose **Server Settings**.
2. In the left navigation menu, select **Integrations** → **Webhooks**.
3. Click **New Webhook** (or **Create Webhook**).
4. Set the name to `Wyvern Vault` and ensure the channel is set to `#cloud-storage`.
5. Click **Copy Webhook URL**.

> ⚠️ **Important**: Your Webhook URL contains secret tokens. Treat it like a password.

---

## Step 3: Complete the Onboarding Wizard

1. Launch the **Wyvern Drive** desktop application.
2. The interactive **Onboarding Wizard** will appear automatically:
   - **Step 1 (Overview)**: Review the core capabilities (Unlimited, Free, AES-256-GCM Encrypted). Click **Continue**.
   - **Step 2 (Guide)**: Confirm you completed the Discord server setup. Click **Continue**.
   - **Step 3 (Webhook Configuration)**: Paste the copied Webhook URL into the input field and click **Test Webhook**.
     - You should see a green verification card with server name and connection latency (e.g., `42ms ping`). Click **Continue**.
   - **Step 4 (Encryption Setup)**: Ensure **Enable AES-256-GCM Encryption** is checked. Click **Generate Secure Key** or enter a custom passphrase.
   - Click **Launch Wyvern Drive**.

```
┌────────────────────────────────────────────────────────┐
│               WYVERN DRIVE ONBOARDING                  │
│                                                        │
│  [✓] Webhook Connected: "Wyvern Vault" (38ms ping)    │
│  [✓] Client-Side AES-256-GCM Key Derived               │
│                                                        │
│             [ Launch Wyvern Drive → ]                  │
└────────────────────────────────────────────────────────┘
```

---

## Step 4: Upload Your First Multi-Chunk File

Now let's upload a file to your new cloud vault:

1. Click the **Upload** button in the top-right header (or drag and drop a file from your desktop directly onto the application window).
2. Select any media file, video (`.mp4`), document (`.pdf`), or archive (`.zip`).
3. Observe the **Transfer Center** in the right drawer:
   - Wyvern Drive automatically inspects the file, computes its SHA-256 checksum, and slices it into **18MB encrypted chunks**.
   - Watch the real-time upload progress, speed in MB/s, and chunk counters (`Chunk 1/3`, `Chunk 2/3`, etc.).
4. Once completed, your file will appear in the main **Drive Explorer** view with an **AES-256** badge.

---

## Step 5: Stream and Inspect Your File

1. Double-click any uploaded video (`.mp4`), audio (`.mp3`), or image (`.png`) in the file explorer.
2. The **Media Previewer** modal opens:
   - Videos and audio begin playing immediately via the embedded HTTP Range streaming server (`http://127.0.0.1:49152/api/stream/{id}`) without needing to download the full file first.
   - You can seek forward and backward across the video timeline.
3. Click the **Chunk Manifest** button in the modal header:
   - Inspect the individual Discord attachment URLs, message IDs, nonces, and chunk hashes stored on Discord's CDN.

---

## Congratulations!
You now have a private, end-to-end encrypted cloud drive powered by your own Discord infrastructure.

### Next Steps:
- Organize your vault with [Virtual Folders](../how-to/configure-webhooks.md).
- Learn how to [Backup and Restore Vault Metadata](../how-to/backup-and-restore.md).
- Read about the [Zero-Knowledge Cryptography Model](../explanation/cryptography-model.md).
