import type { ComponentType, SVGAttributes } from 'react';
import {
  FileImage,
  FileVideo,
  FileAudio,
  FilePdf,
  FileArchive,
  FileText,
  FileXls,
  FilePpt,
  File,
} from '@phosphor-icons/react';

type IconProps = Omit<SVGAttributes<SVGElement>, 'children'> & {
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  color?: string;
  mirrored?: boolean;
};

export type PhosphorIcon = ComponentType<IconProps>;

/**
 * Resolve the appropriate Phosphor file-type icon for a given MIME type.
 * Returns the component (not JSX) so callers can compose size, weight,
 * className, and aria-hidden consistently.
 */
export function getFileIcon(mimeType: string): PhosphorIcon {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType === 'application/pdf') return FilePdf;
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar') ||
    mimeType.includes('gzip')
  ) {
    return FileArchive;
  }
  if (
    mimeType.includes('word') ||
    mimeType.includes('office') ||
    mimeType.includes('document')
  ) {
    return FileText;
  }
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return FileXls;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return FilePpt;
  }
  return File;
}
