import React from 'react';
import { render, screen } from '@testing-library/react';
import BrandLockup from './BrandLockup';

describe('BrandLockup', () => {
  it('renders the visible wordmark and no other text', () => {
    const { container } = render(<BrandLockup />);
    expect(screen.getByText('Wyvern Drive')).toBeInTheDocument();
    // The glyph cell is aria-hidden; the wordmark is the only text.
    expect(container.textContent).toBe('Wyvern Drive');
  });

  it('renders for compact and non-compact sizes', () => {
    const { rerender } = render(<BrandLockup />);
    expect(screen.getByText('Wyvern Drive').className).toContain(
      'MuiTypography-h6'
    );
    rerender(<BrandLockup compact />);
    expect(screen.getByText('Wyvern Drive').className).toContain(
      'MuiTypography-subtitle2'
    );
  });

  it('honors the align prop on the flex container', () => {
    const { container, rerender } = render(<BrandLockup align="center" />);
    expect(container.firstChild).toHaveStyle({ justifyContent: 'center' });
    rerender(<BrandLockup align="left" />);
    expect(container.firstChild).toHaveStyle({ justifyContent: 'flex-start' });
  });
});
