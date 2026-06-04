interface DrivePageProps {
  parentId: string | null;
}

export function DrivePage({ parentId }: DrivePageProps) {
  return (
    <div style={{ padding: 24, color: 'var(--text-secondary)' }}>
      Drive shell placeholder (parent: <code>{parentId ?? 'root'}</code>)
    </div>
  );
}
