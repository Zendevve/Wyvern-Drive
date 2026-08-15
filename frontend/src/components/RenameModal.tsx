import React, { useState } from 'react';
import { X, Edit2 } from 'lucide-react';

interface RenameModalProps {
  initialName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  initialName,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState<string>(initialName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onRename(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/80 backdrop-blur-md p-6 select-none">
      <div className="w-full max-w-md bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-wyvern-500/20 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Rename</h3>
              <p className="text-[10px] text-slate-400">Enter a new name</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-obsidian-elevated border border-obsidian-border rounded-xl text-xs text-white focus:outline-none focus:border-wyvern-500"
            />
          </div>

          <div className="pt-3 border-t border-obsidian-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-obsidian-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || name === initialName}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-wyvern-600 hover:bg-wyvern-500 shadow-glow-blurple transition-all disabled:opacity-50"
            >
              Save Name
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
