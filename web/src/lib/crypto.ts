export async function deriveAccountId(webhookUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(webhookUrl);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
