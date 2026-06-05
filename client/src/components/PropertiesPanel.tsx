import React from "react";
import type { Element, TextStyle } from "../lib/types";
import { Sliders } from "lucide-react";

interface Props {
  selectedElement: Element | undefined;
  onUpdateElement: (id: string, updates: Partial<Element>) => void;
  defaultTextStyle: TextStyle;
}

export const PropertiesPanel: React.FC<Props> = ({
  selectedElement,
  onUpdateElement,
  defaultTextStyle,
}) => {
  if (!selectedElement) return null;

  return (
    <div className="fixed right-4 top-24 z-[55] bg-white/90 shadow-2xl rounded-3xl border border-slate-200/60 p-4.5 w-60 max-h-[65vh] overflow-y-auto backdrop-blur-md transition-all duration-300 hover:shadow-3xl">
      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3 flex-shrink-0">
        <Sliders size={16} className="text-slate-500" />
        Properties
      </h3>

      <div className="space-y-3.5 text-xs text-slate-600">
        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
          <span className="font-medium text-slate-500">Tool Type</span>
          <span className="font-mono font-semibold text-slate-800 uppercase text-[10px]">
            {selectedElement.tool}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-medium pl-0.5">X Coordinate</span>
            <input
              type="number"
              value={Math.round(selectedElement.x)}
              onChange={(e) => onUpdateElement(selectedElement.id, { x: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-slate-400 focus:outline-none bg-slate-50/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-medium pl-0.5">Y Coordinate</span>
            <input
              type="number"
              value={Math.round(selectedElement.y)}
              onChange={(e) => onUpdateElement(selectedElement.id, { y: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-slate-400 focus:outline-none bg-slate-50/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-medium pl-0.5">Width</span>
            <input
              type="number"
              value={Math.round(selectedElement.width)}
              onChange={(e) => onUpdateElement(selectedElement.id, { width: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-slate-400 focus:outline-none bg-slate-50/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-medium pl-0.5">Height</span>
            <input
              type="number"
              value={Math.round(selectedElement.height)}
              onChange={(e) => onUpdateElement(selectedElement.id, { height: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-slate-400 focus:outline-none bg-slate-50/50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-medium pl-0.5">Stroke Color</span>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={selectedElement.color}
              onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
              className="w-9 h-9 border border-slate-200 rounded-xl cursor-pointer p-0.5 bg-white shadow-sm"
            />
            <span className="font-mono text-xs text-slate-500 uppercase">{selectedElement.color}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-medium pl-0.5">
            Opacity ({Math.round((selectedElement.opacity ?? 1) * 100)}%)
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={(selectedElement.opacity ?? 1) * 100}
            onChange={(e) => onUpdateElement(selectedElement.id, { opacity: Number(e.target.value) / 100 })}
            className="w-full h-1 accent-slate-900 rounded-lg cursor-pointer bg-slate-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-medium pl-0.5">Text Font Family</span>
          <select
            value={selectedElement.textStyle || defaultTextStyle}
            onChange={(e) => onUpdateElement(selectedElement.id, { textStyle: e.target.value as TextStyle })}
            className="w-full border border-slate-200 rounded-xl px-2.5 py-2.5 focus:border-slate-400 focus:outline-none bg-slate-50/50 text-xs text-slate-700"
          >
            <option value="rough">Rough (default)</option>
            <option value="clean">Clean</option>
            <option value="mono">Mono</option>
          </select>
        </div>
      </div>
    </div>
  );
};
