import type { Context } from "@netlify/edge-functions";

const API_URL = "https://lrqnovltirjsoqfvtxxu.supabase.co/functions/v1/api";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycW5vdmx0aXJqc29xZnZ0eHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NzQ0MjcsImV4cCI6MjA4MTE1MDQyN30.rpusoKvKGgWHofrM15aqWMh5F6A8yx78u_n2vgXxm1Q";

interface ShareInfo {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  expiresAt: string | null;
  passwordRequired: boolean;
  downloadCount: number;
}

/**
 * Detect if request is from a social media bot that needs OG tags
 */
function isSocialBot(userAgent: string): boolean {
  const botPatterns = [
    /Discordbot/i,
    /Twitterbot/i,
    /Slackbot/i,
    /facebookexternalhit/i,
    /LinkedInBot/i,
    /TelegramBot/i,
    /WhatsApp/i,
    /Googlebot/i,
    /bingbot/i,
  ];
  return botPatterns.some((pattern) => pattern.test(userAgent));
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Get file type label for OG display
 */
function getFileTypeLabel(fileType: string): string {
  if (fileType.startsWith("image/")) return "Image";
  if (fileType.startsWith("video/")) return "Video";
  if (fileType.startsWith("audio/")) return "Audio";
  if (fileType.includes("pdf")) return "PDF";
  if (fileType.includes("zip") || fileType.includes("rar")) return "Archive";
  if (fileType.includes("text") || fileType.includes("document")) return "Document";
  return "File";
}

export default async function handler(request: Request, context: Context) {
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";

  // Only intercept /share/:shareId routes
  const match = url.pathname.match(/^\/share\/([a-zA-Z0-9_-]+)$/);
  if (!match) {
    return context.next();
  }

  // If not a social bot, serve the React app normally
  if (!isSocialBot(userAgent)) {
    return context.next();
  }

  const shareId = match[1];

  try {
    // Fetch share info from API
    const res = await fetch(`${API_URL}/share/${shareId}/info`, {
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      // Return default OG tags for invalid/expired shares
      return generateOGResponse(url.href, {
        title: "Share Link - Wyvern Drive",
        description: "This share link may have expired or been removed.",
        fileTypeLabel: "File",
      });
    }

    const shareInfo: ShareInfo = await res.json();

    // Generate OG tags based on file info
    const fileTypeLabel = getFileTypeLabel(shareInfo.fileType);
    const sizeStr = formatFileSize(shareInfo.fileSize);

    const ogData = {
      title: shareInfo.fileName,
      description: `${fileTypeLabel} | ${sizeStr} | ${shareInfo.downloadCount} downloads`,
      fileTypeLabel,
      fileName: shareInfo.fileName,
      fileSize: sizeStr,
      fileType: shareInfo.fileType,
      passwordRequired: shareInfo.passwordRequired,
      expiresAt: shareInfo.expiresAt,
    };

    return generateOGResponse(url.href, ogData);
  } catch (error) {
    console.error("Edge function error:", error);
    return context.next();
  }
}

interface OGData {
  title: string;
  description: string;
  fileTypeLabel: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  passwordRequired?: boolean;
  expiresAt?: string | null;
}

function generateOGResponse(pageUrl: string, data: OGData): Response {
  // Discord-friendly embed colors and theming
  const themeColor = "#5865F2"; // Discord blurple

  // Build description with extra info
  let fullDescription = data.description;
  if (data.passwordRequired) {
    fullDescription += " | Password protected";
  }
  if (data.expiresAt) {
    const expiry = new Date(data.expiresAt);
    fullDescription += ` | Expires ${expiry.toLocaleDateString()}`;
  }

  // Generate HTML with OG meta tags
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Primary Meta Tags -->
  <title>${escapeHtml(data.title)} - Wyvern Drive</title>
  <meta name="title" content="${escapeHtml(data.title)} - Wyvern Drive" />
  <meta name="description" content="${escapeHtml(fullDescription)}" />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:title" content="${escapeHtml(data.title)}" />
  <meta property="og:description" content="${escapeHtml(fullDescription)}" />
  <meta property="og:site_name" content="Wyvern Drive" />

  <!-- Twitter -->
  <meta property="twitter:card" content="summary" />
  <meta property="twitter:url" content="${escapeHtml(pageUrl)}" />
  <meta property="twitter:title" content="${escapeHtml(data.title)}" />
  <meta property="twitter:description" content="${escapeHtml(fullDescription)}" />

  <!-- Discord-specific -->
  <meta name="theme-color" content="${themeColor}" />

  <!-- Redirect to actual page after bot reads meta -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}" />
</head>
<body>
  <p>Redirecting to ${escapeHtml(data.fileName || "file")}...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300", // Cache for 5 minutes
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const config = {
  path: "/share/*",
};

