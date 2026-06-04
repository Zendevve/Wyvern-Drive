import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface Crumb {
  id: string | null;
  name: string;
}

interface BreadcrumbProps {
  chain: Crumb[];
}

export function Breadcrumb({ chain }: BreadcrumbProps) {
  if (chain.length === 0) return null;
  return (
    <nav className="crumb" aria-label="Breadcrumb">
      {chain.map((segment, index) => {
        const isLast = index === chain.length - 1;
        const href = segment.id ? `/drive/${segment.id}` : '/drive';
        return (
          <span key={`${segment.id ?? 'root'}-${index}`}>
            {isLast ? (
              <span className="crumb-current" aria-current="page">{segment.name}</span>
            ) : (
              <Link to={href} className="crumb-link">{segment.name}</Link>
            )}
            {!isLast ? <span className="crumb-sep" aria-hidden>/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

export type BreadcrumbNode = ReactNode;
