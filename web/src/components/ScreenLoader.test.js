import React from 'react';
import { render, screen } from '@testing-library/react';
import ScreenLoader from './ScreenLoader';

describe('ScreenLoader', () => {
  it('renders a progressbar labeled with the default "Loading"', () => {
    render(<ScreenLoader />);
    expect(
      screen.getByRole('progressbar', { name: 'Loading' })
    ).toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders a custom label on the progressbar and as visible text', () => {
    render(<ScreenLoader label="Checking storage" />);
    expect(
      screen.getByRole('progressbar', { name: 'Checking storage' })
    ).toBeInTheDocument();
    expect(screen.getByText('Checking storage')).toBeInTheDocument();
  });
});
