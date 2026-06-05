import React from "react";
import type { Element } from "../lib/types";
import { Layers, Lock, Unlock, Trash2 } from "lucide-react";

interface Props {
  elements: Element[];
  onSelectLayer: (id: string) => void;
  onToggleLock: () => void;
  onDeleteLayer: (id: string) => void;
}

export const LayersPanel: React.FC<Props> = ({
  elements,
  onSelectLayer,
  onToggleLock,
  onDeleteLayer,
}) => {
  return (
    <div className="fixed right-4 top-24 z-[50] bg-white/90 shadow-2xl rounded-3xl border border-slate-200/60 p-4.5 w-60 max-h-[60vh] overflow-y-auto backdrop-blur-md transition-all duration-300 hover:shadow-3xl flex flex-col">
      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3 flex-shrink-0">
        <Layers size={16} className="text-slate-500" />
        Layers
      </h3>

      <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
        {elements.length === 0 ? (
          <div className="text-slate-400 text-xs text-center py-6">
            No shapes on canvas yet.
          </div>
        ) : (
          [...elements].reverse().map((el, i) => {
            const index = elements.length - i;
            return (
              <div
                key={el.id}
                onClick={() => onSelectLayer(el.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all border ${
                  el.isSelected
                    ? "bg-slate-900 border-slate-900 text-white font-medium shadow-md"
                    : "hover:bg-slate-50 border-transparent text-slate-700"
                }`}
              >
                <span
                  className={`w-4 text-center font-mono ${
                    el.isSelected ? "text-slate-400" : "text-slate-400"
                  }`}
                >
                  {index}
                </span>
                <span className="flex-1 truncate uppercase tracking-wider text-[10px]">
                  {el.tool}
                  {el.text ? `: ${el.text.slice(0, 10)}` : ""}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Select it first to toggle lock on it
                    onSelectLayer(el.id);
                    // Defer toggleLock slightly so state updates
                    setTimeout(onToggleLock, 0);
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    el.isSelected
                      ? "hover:bg-slate-800 text-slate-300 hover:text-white"
                      : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                  }`}
                  title={el.locked ? "Unlock" : "Lock"}
                >
                  {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLayer(el.id);
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    el.isSelected
                      ? "hover:bg-rose-900/60 text-rose-300 hover:text-rose-200"
                      : "hover:bg-rose-50 text-rose-500 hover:text-rose-600"
                  }`}
                  title="Delete element"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
