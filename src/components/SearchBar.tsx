import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchStore } from '../stores/search-store';

export function SearchBar() {
  const [localQuery, setLocalQuery] = useState('');
  const setQuery = useSearchStore(s => s.setQuery);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback((value: string) => {
    setLocalQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setQuery(value), 300);
  }, [setQuery]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="flex items-center gap-2 mb-4">
      <input
        type="text"
        value={localQuery}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search files..."
        aria-label="Search files"
        className="flex-1 bg-dark-bg border border-gray-600 rounded px-3 py-2 text-sm"
      />
    </div>
  );
}
