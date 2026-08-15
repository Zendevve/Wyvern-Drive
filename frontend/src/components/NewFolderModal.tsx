import React, { useState } from 'react';
import { X, FolderPlus, Palette } from 'lucide-react';

interface NewFolderModalProps {
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#5865F2');

  const colorPalette = [
    '#5865F2', // Blurple
    '#00f2fe', // Cyan
    '#10b981', // Emerald
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#64748b', // Slate
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), selectedColor);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/80 backdrop-blur-md p-6 select-none">
      <div className="w-full max-w-md bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: selectedColor }}
            >
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                New Virtual Folder
              </h3>
              <p className="text-[10px] text-slate-400">Organize your files in Discord storage</p>
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
            <label className="text-xs font-medium text-slate-300">Folder Name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Media Projects, Documents, Photos..."
              className="w-full px-3.5 py-2 bg-obsidian-elevated border border-obsidian-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-wyvern-500"
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              <span>Accent Color</span>
            </label>
            <div className="flex items-center gap-2.5">
              {colorPalette.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    selectedColor === color ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
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
              disabled={!name.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-wyvern-600 hover:bg-wyvern-500 shadow-glow-blurple transition-all disabled:opacity-50"
            >
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
