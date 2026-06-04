import type { ComponentType, SVGProps } from 'react';
import type { Node } from '../api/fs';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
};

export function Folder(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

export function File(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function Image(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L9 19" />
    </svg>
  );
}

export function Video(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <path d="m17 10 4-2v8l-4-2z" />
    </svg>
  );
}

export function Audio(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

export function Archive(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function Document(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

export const IconFolder = Folder;
export const IconFile = File;

type IconTarget = { mimeType?: string | null; name: string; kind: 'file' | 'folder' };

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']);
const ARCHIVE_EXT = new Set(['zip', 'tar', 'gz', '7z', 'rar', 'tgz']);
const DOC_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'csv', 'odt']);

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

function startsWithMime(mime: string, prefix: string): boolean {
  return mime.toLowerCase().startsWith(prefix);
}

export function getFileIcon(item: IconTarget): ComponentType<IconProps> {
  if (item.kind === 'folder') return Folder;
  const mime = (item.mimeType || '').toLowerCase();
  if (mime) {
    if (startsWithMime(mime, 'image/')) return Image;
    if (startsWithMime(mime, 'video/')) return Video;
    if (startsWithMime(mime, 'audio/')) return Audio;
    if (startsWithMime(mime, 'application/zip') || startsWithMime(mime, 'application/x-tar') ||
        startsWithMime(mime, 'application/x-7z') || startsWithMime(mime, 'application/x-rar')) return Archive;
    if (mime === 'application/pdf' || startsWithMime(mime, 'text/')) return Document;
  }
  const ext = extOf(item.name);
  if (IMAGE_EXT.has(ext)) return Image;
  if (VIDEO_EXT.has(ext)) return Video;
  if (AUDIO_EXT.has(ext)) return Audio;
  if (ARCHIVE_EXT.has(ext)) return Archive;
  if (DOC_EXT.has(ext)) return Document;
  return File;
}

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatTimestamp(ts: number | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export type { Node };
