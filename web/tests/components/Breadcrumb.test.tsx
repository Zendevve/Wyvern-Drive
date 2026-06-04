import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumb } from '../../src/components/Breadcrumb';

function renderWithRouter(ui: React.ReactNode, initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
  );
}

describe('Breadcrumb', () => {
  it('renders the root and folder segments', () => {
    renderWithRouter(
      <Breadcrumb
        chain={[
          { id: null, name: 'My Drive' },
          { id: 'folder-1', name: 'Photos' },
          { id: 'folder-2', name: 'Vacation' }
        ]}
      />
    );

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('My Drive')).toBeInTheDocument();
    expect(within(nav).getByText('Photos')).toBeInTheDocument();
    expect(within(nav).getByText('Vacation')).toBeInTheDocument();
  });

  it('marks the last segment as the current page and bolds it', () => {
    renderWithRouter(
      <Breadcrumb
        chain={[
          { id: null, name: 'My Drive' },
          { id: 'folder-1', name: 'Photos' }
        ]}
      />
    );

    const current = screen.getByText('Photos');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.className).toContain('crumb-current');
  });

  it('links each non-last segment to its folder route', () => {
    renderWithRouter(
      <Breadcrumb
        chain={[
          { id: null, name: 'My Drive' },
          { id: 'folder-1', name: 'Photos' },
          { id: 'folder-2', name: 'Vacation' }
        ]}
      />
    );

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const rootLink = within(nav).getByRole('link', { name: 'My Drive' });
    const photosLink = within(nav).getByRole('link', { name: 'Photos' });
    expect(rootLink).toHaveAttribute('href', '/drive');
    expect(photosLink).toHaveAttribute('href', '/drive/folder-1');
  });

  it('renders nothing for an empty chain', () => {
    renderWithRouter(<Breadcrumb chain={[]} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('inserts separators between segments', () => {
    const { container } = renderWithRouter(
      <Breadcrumb
        chain={[
          { id: null, name: 'My Drive' },
          { id: 'folder-1', name: 'Photos' }
        ]}
      />
    );
    expect(container.querySelectorAll('.crumb-sep').length).toBe(1);
  });
});
