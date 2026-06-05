import { useMemo } from 'react';
import { Document, Image, Video, Audio, File, formatBytes } from '../icons';

interface CategoryBreakdownProps {
  categories: {
    documents: number;
    images: number;
    videos: number;
    audio: number;
    others: number;
  };
}

const CAPACITY_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const items = useMemo(() => {
    const list = [
      {
        name: 'Documents',
        bytes: categories.documents,
        icon: Document,
        color: '#FFFFFF'
      },
      {
        name: 'Images',
        bytes: categories.images,
        icon: Image,
        color: '#FFFFFF'
      },
      {
        name: 'Videos',
        bytes: categories.videos,
        icon: Video,
        color: '#FFFFFF'
      },
      {
        name: 'Audio',
        bytes: categories.audio,
        icon: Audio,
        color: '#FFFFFF'
      },
      {
        name: 'Others',
        bytes: categories.others,
        icon: File,
        color: '#FFFFFF'
      }
    ];
    return list;
  }, [categories]);

  return (
    <div className="category-breakdown">
      <h3 className="category-breakdown-title">Storage Breakdown</h3>
      <div className="category-breakdown-list">
        {items.map((item) => {
          const pct = CAPACITY_BYTES > 0 ? (item.bytes / CAPACITY_BYTES) * 100 : 0;
          const displayPct = Math.min(100, Math.max(0, pct));
          const Icon = item.icon;

          return (
            <div key={item.name} className="category-item">
              <div className="category-info">
                <div className="category-label">
                  <Icon className="category-icon" width="16" height="16" />
                  <span className="category-name">{item.name}</span>
                </div>
                <span className="category-size">{formatBytes(item.bytes)}</span>
              </div>
              <div className="category-progress-track">
                <div
                  className="category-progress-fill"
                  style={{
                    width: `${displayPct.toFixed(2)}%`,
                    minWidth: item.bytes > 0 ? '3px' : '0px',
                    transition: 'width 0.6s var(--ease-out)'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
