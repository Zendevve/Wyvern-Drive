import type { EntryDTO } from "../types/dto";
import { formatTimestamp } from "../format";

export interface BreadcrumbSegment {
  id: string | null;
  name: string;
}

export function Breadcrumb({
  trail,
  disabled,
  onNavigate,
  onBack,
}: {
  trail: BreadcrumbSegment[];
  disabled: boolean;
  onNavigate: (id: string | null) => void;
  onBack: () => void;
}) {
  return (
    <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
      <button
        type="button"
        disabled={disabled || trail.length === 0}
        onClick={onBack}
        className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-100 disabled:opacity-50"
      >
        Back
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onNavigate(null)}
        aria-current={trail.length === 0}
        className="rounded px-2 py-1 hover:bg-stone-100 disabled:opacity-50"
      >
        Root
      </button>
      {trail.map((segment) => (
        <span key={segment.id ?? "root"} className="flex items-center gap-1">
          <span aria-hidden="true" className="text-stone-400">
            /
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onNavigate(segment.id)}
            aria-current={segment === trail[trail.length - 1]}
            className="rounded px-2 py-1 hover:bg-stone-100 disabled:opacity-50"
          >
            {segment.name}
          </button>
        </span>
      ))}
    </nav>
  );
}

export function FolderTable({
  entries,
  selectedId,
  onSelect,
  onOpenFolder,
}: {
  entries: EntryDTO[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenFolder: (entry: EntryDTO) => void;
}) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-500">This folder is empty.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
          <th scope="col" className="px-2 py-1 font-medium">
            Name
          </th>
          <th scope="col" className="px-2 py-1 font-medium">
            Modified
          </th>
          <th scope="col" className="px-2 py-1 font-medium">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.id}
            aria-selected={entry.id === selectedId}
            onClick={() => onSelect(entry.id === selectedId ? null : entry.id)}
            onDoubleClick={() => {
              if (entry.kind === "folder") onOpenFolder(entry);
            }}
            className={
              entry.id === selectedId
                ? "cursor-pointer bg-stone-200"
                : "cursor-pointer hover:bg-stone-100"
            }
          >
            <td className="px-2 py-1.5">
              {entry.kind === "folder" ? (
                <button
                  type="button"
                  onClick={() => onOpenFolder(entry)}
                  className="rounded px-1 py-0.5 text-left hover:bg-stone-200"
                >
                  {entry.name}
                </button>
              ) : (
                entry.name
              )}
            </td>
            <td className="px-2 py-1.5 text-stone-600">
              {formatTimestamp(entry.updated_at)}
            </td>
            <td className="px-2 py-1.5 text-stone-600">{entry.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
