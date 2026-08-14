import {
  faFile,
  faFileAudio,
  faFileCode,
  faFileImage,
  faFileLines,
  faFilePdf,
  faFileVideo,
  faFileZipper,
  faFolder,
} from '@fortawesome/free-solid-svg-icons';

const ARCHIVE_RE = /(zip|gzip|tar|7z|x-7z|x-rar)/;

function isCodeMime(mime, name = '') {
  return (
    mime.includes('javascript') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('yaml') ||
    mime.includes('html') ||
    mime.includes('css') ||
    name.endsWith('.js') ||
    name.endsWith('.json') ||
    name.endsWith('.ts') ||
    name.endsWith('.py') ||
    name.endsWith('.rs') ||
    name.endsWith('.go')
  );
}

function classify(entry) {
  if (!entry) {
    return { icon: faFile, color: '#9AA5B8', bg: 'rgba(154, 165, 184, 0.12)', label: 'File' };
  }
  if (entry.kind === 'folder') {
    return {
      icon: faFolder,
      color: '#FFB020',
      bg: 'rgba(255, 176, 32, 0.14)',
      label: 'Folder',
    };
  }
  const mime = (entry.mimeType || '').toLowerCase();
  const name = (entry.name || '').toLowerCase();

  if (mime.startsWith('image/')) {
    return {
      icon: faFileImage,
      color: '#FF9F0A',
      bg: 'rgba(255, 159, 10, 0.14)',
      label: 'Image',
    };
  }
  if (mime.startsWith('video/')) {
    return {
      icon: faFileVideo,
      color: '#BF5AF2',
      bg: 'rgba(191, 90, 242, 0.14)',
      label: 'Video',
    };
  }
  if (mime.startsWith('audio/')) {
    return {
      icon: faFileAudio,
      color: '#1E86FF',
      bg: 'rgba(30, 134, 255, 0.14)',
      label: 'Audio',
    };
  }
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return {
      icon: faFilePdf,
      color: '#FF453A',
      bg: 'rgba(255, 69, 58, 0.14)',
      label: 'PDF',
    };
  }
  if (ARCHIVE_RE.test(mime) || name.endsWith('.zip') || name.endsWith('.tar.gz')) {
    return {
      icon: faFileZipper,
      color: '#FFD60A',
      bg: 'rgba(255, 214, 10, 0.14)',
      label: 'Archive',
    };
  }
  if (isCodeMime(mime, name)) {
    return {
      icon: faFileCode,
      color: '#30D158',
      bg: 'rgba(48, 209, 88, 0.14)',
      label: 'Code',
    };
  }
  if (mime.startsWith('text/')) {
    return {
      icon: faFileLines,
      color: '#64D2FF',
      bg: 'rgba(100, 210, 255, 0.14)',
      label: 'Document',
    };
  }
  return {
    icon: faFile,
    color: '#9AA5B8',
    bg: 'rgba(154, 165, 184, 0.12)',
    label: 'File',
  };
}

/**
 * Maps an entry to its FontAwesome icon, color, and background badge by type.
 */
export function entryIcon(entry) {
  const { icon, color, bg } = classify(entry);
  return { icon, color, bg };
}

/** Short human label for an entry's type ('Folder', 'Image', 'PDF', ...). */
export function fileTypeLabel(entry) {
  return classify(entry).label;
}
