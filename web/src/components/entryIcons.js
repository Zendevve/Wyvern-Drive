import {
  faFile,
  faFileAudio,
  faFileImage,
  faFileLines,
  faFilePdf,
  faFileVideo,
  faFileZipper,
  faFolder,
} from '@fortawesome/free-solid-svg-icons';

const ARCHIVE_RE = /(zip|gzip|tar|7z|x-7z|x-rar)/;

function isTextMime(mime) {
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime.includes('javascript') ||
    mime.includes('xml') ||
    mime.includes('yaml')
  );
}

function classify(entry) {
  if (entry.kind === 'folder') {
    return { icon: faFolder, color: '#FFFFFF', label: 'Folder' }; // ink
  }
  const mime = (entry.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) {
    return { icon: faFileImage, color: '#999999', label: 'Image' }; // inkMuted
  }
  if (mime.startsWith('video/')) {
    return { icon: faFileVideo, color: '#999999', label: 'Video' };
  }
  if (mime.startsWith('audio/')) {
    return { icon: faFileAudio, color: '#999999', label: 'Audio' };
  }
  if (mime === 'application/pdf') {
    return { icon: faFilePdf, color: '#999999', label: 'PDF' };
  }
  if (ARCHIVE_RE.test(mime)) {
    return { icon: faFileZipper, color: '#999999', label: 'Archive' };
  }
  if (isTextMime(mime)) {
    return { icon: faFileLines, color: '#999999', label: 'Text' };
  }
  return { icon: faFile, color: '#999999', label: 'File' };
}

/**
 * Maps an entry to its FontAwesome icon and monochrome color by type.
 * Folders are ink; files are inkMuted. Type is carried by glyph, not color.
 */
export function entryIcon(entry) {
  const { icon, color } = classify(entry);
  return { icon, color };
}

/** Short human label for an entry's type ('Folder', 'Image', 'PDF', ...). */
export function fileTypeLabel(entry) {
  return classify(entry).label;
}
