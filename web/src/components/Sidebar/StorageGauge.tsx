import { useMemo } from 'react';
import { formatBytes } from '../icons';

interface StorageGaugeProps {
  totalBytes: number;
}

const CAPACITY_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

export function StorageGauge({ totalBytes }: StorageGaugeProps) {
  const percentage = useMemo(() => {
    if (totalBytes <= 0) return 0;
    const pct = (totalBytes / CAPACITY_BYTES) * 100;
    return Math.min(100, Math.max(0, pct));
  }, [totalBytes]);

  // Semi-circle path with radius 64
  // Path length (circumference of semi-circle) = PI * 64 ≈ 201.06
  const pathLength = 201.06;
  const dashOffset = pathLength - (pathLength * percentage) / 100;

  return (
    <div className="storage-gauge-container">
      <div className="storage-gauge-visual">
        <svg width="160" height="90" viewBox="0 0 160 90">
          <defs>
            <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Background Track */}
          <path
            d="M 16 80 A 64 64 0 0 1 144 80"
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          
          {/* Active Progress */}
          {percentage > 0 && (
            <path
              d="M 16 80 A 64 64 0 0 1 144 80"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={pathLength}
              strokeDashoffset={dashOffset}
              filter="url(#gauge-glow)"
              style={{ transition: 'stroke-dashoffset 0.6s var(--ease-out)' }}
            />
          )}
        </svg>
        <div className="storage-gauge-center">
          <span className="storage-percentage">{percentage.toFixed(1)}%</span>
          <span className="storage-used-label">Used</span>
        </div>
      </div>
      
      <div className="storage-gauge-text">
        <div className="storage-gauge-capacity">
          <span className="storage-bytes-used">{formatBytes(totalBytes)}</span>
          <span className="storage-bytes-total"> of {formatBytes(CAPACITY_BYTES)}</span>
        </div>
      </div>
    </div>
  );
}
