import React from "react";
import { Undo, Redo, Download, Trash2 } from "lucide-react";

interface Props {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const TopBar: React.FC<Props> = ({
  onUndo,
  onRedo,
  onClear,
  onExport,
  canUndo,
  canRedo,
}) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white shadow-xl rounded-2xl border border-gray-200 px-4 py-2 flex items-center gap-3 z-40">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo"
      >
        <Undo size={18} />
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo"
      >
        <Redo size={18} />
      </button>

      <div className="w-px h-6 bg-gray-200" />

      <button
        onClick={onExport}
        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
        title="Export as PNG"
      >
        <Download size={18} />
      </button>

      <button
        onClick={onClear}
        className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
        title="Clear Canvas"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};