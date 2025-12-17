
const BOT_TOKEN = "<REDACTED-BOT-TOKEN>";
const CHANNEL_ID = "1449896342200651911";

async function checkChannel() {
  console.log(`Checking channel ${CHANNEL_ID}...`);
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=10`, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
      },
    });

    if (!res.ok) {
      console.error(`Error: ${res.status} ${res.statusText}`);
      console.error(await res.text());
      return;
    }

    const messages = await res.json();
    console.log(`Found ${messages.length} messages.`);
    if (messages.length > 0) {
      const m = messages[0];
      console.log("Sample Message:", JSON.stringify(m, null, 2));
      if (m.attachments && m.attachments.length > 0) {
        console.log("Sample Attachment URL:", m.attachments[0].url);
      }
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

checkChannel();
