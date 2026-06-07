import React from "react";
import type { Element, TextStyle, TextElement } from "../lib/types";
import { Sliders } from "lucide-react";

interface Props {
  selectedElement: Element | TextElement | undefined;
  onUpdateElement: (id: string, updates: any) => void;
}

export const PropertiesPanel: React.FC<Props> = ({
  selectedElement,
  onUpdateElement,
}) => {
  if (!selectedElement) return null;

  const isTextElement = "type" in selectedElement;

  // Resolve current formatting values
  const color = isTextElement 
    ? (selectedElement as TextElement).style.color 
    : (selectedElement as Element).color || "#000000";

  const fontSize = isTextElement
    ? (selectedElement as TextElement).style.fontSize
    : (selectedElement as Element).fontSize || 13;

  const fontFamily = isTextElement
    ? (selectedElement as TextElement).style.fontFamily
    : (selectedElement as Element).fontFamily || "";

  const bold = isTextElement
    ? (selectedElement as TextElement).style.bold
    : (selectedElement as Element).bold || false;

  const italic = isTextElement
    ? (selectedElement as TextElement).style.italic
    : (selectedElement as Element).italic || false;

  const align = isTextElement
    ? (selectedElement as TextElement).style.align
    : (selectedElement as Element).textAlign || "left";

  const lineHeight = isTextElement
    ? (selectedElement as TextElement).style.lineHeight
    : (selectedElement as Element).lineHeight || 1.2;

  const updateStyle = (styleUpdates: Partial<TextStyle>) => {
    if (isTextElement) {
      const textEl = selectedElement as TextElement;
      onUpdateElement(textEl.id, { style: { ...textEl.style, ...styleUpdates } });
    } else {
      const elementUpdates: Partial<Element> = {};
      if (styleUpdates.fontSize !== undefined) elementUpdates.fontSize = styleUpdates.fontSize;
      if (styleUpdates.fontFamily !== undefined) elementUpdates.fontFamily = styleUpdates.fontFamily;
      if (styleUpdates.color !== undefined) elementUpdates.color = styleUpdates.color;
      if (styleUpdates.bold !== undefined) elementUpdates.bold = styleUpdates.bold;
      if (styleUpdates.italic !== undefined) elementUpdates.italic = styleUpdates.italic;
      if (styleUpdates.align !== undefined) elementUpdates.textAlign = styleUpdates.align as any;
      if (styleUpdates.lineHeight !== undefined) elementUpdates.lineHeight = styleUpdates.lineHeight;
      
      onUpdateElement(selectedElement.id, elementUpdates);
    }
  };

  return (
    <div className="fixed sm:right-4 sm:top-24 right-0 bottom-0 sm:bottom-auto sm:w-60 w-full z-[55] bg-white/90 shadow-2xl rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200/60 p-4.5 max-h-[45vh] sm:max-h-[65vh] overflow-y-auto backdrop-blur-md transition-all duration-300 hover:shadow-3xl">
      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3 flex-shrink-0">
        <Sliders size={16} className="text-slate-500" />
        Properties
      </h3>

      <div className="space-y-3.5 text-xs text-slate-600">
        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
          <span className="font-medium text-slate-500">Tool Type</span>
          <span className="font-mono font-semibold text-slate-800 uppercase text-[10px]">
            {isTextElement ? "TEXT" : (selectedElement as Element).tool}
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

        {/* Color picker */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-medium pl-0.5">Color</span>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={color}
              onChange={(e) => {
                const newColor = e.target.value;
                if (isTextElement) {
                  updateStyle({ color: newColor });
                } else {
                  onUpdateElement(selectedElement.id, { color: newColor });
                }
              }}
              className="w-9 h-9 border border-slate-200 rounded-xl cursor-pointer p-0.5 bg-white shadow-sm"
            />
            <span className="font-mono text-xs text-slate-500 uppercase">{color}</span>
          </div>
        </div>

        {/* Opacity slider */}
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

        {/* Text styling header */}
        <div className="border-t border-slate-100 pt-3 mt-3 flex-shrink-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase pl-0.5">Text Formatting</span>
        </div>

        {/* Font Family selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-medium pl-0.5">Font Family</span>
          <select
            value={fontFamily}
            onChange={(e) => updateStyle({ fontFamily: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-2.5 py-2 focus:border-slate-400 focus:outline-none bg-slate-50/50 text-xs text-slate-700"
          >
            <option value="">Default Font</option>
            <option value="Inter, sans-serif">Inter</option>
            <option value="'Caveat', cursive">Caveat (Comic)</option>
            <option value="ui-monospace, monospace">Monospace</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Courier New', Courier, monospace">Courier New</option>
          </select>
        </div>

        {/* Font Size input */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-medium pl-0.5">Font Size (px)</span>
          <input
            type="number"
            min="8"
            max="120"
            value={fontSize}
            onChange={(e) => updateStyle({ fontSize: Number(e.target.value) || 12 })}
            className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-slate-400 focus:outline-none bg-slate-50/50"
          />
        </div>

        {/* Bold & Italic toggles */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => updateStyle({ bold: !bold })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex-1 transition-all ${
              bold 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Bold
          </button>
          <button
            onClick={() => updateStyle({ italic: !italic })}
            className={`px-3 py-1.5 rounded-xl border text-xs italic font-semibold flex-1 transition-all ${
              italic 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Italic
          </button>
        </div>

        {/* Text Alignment */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-medium pl-0.5">Alignment</span>
          <div className="flex bg-slate-50/50 border border-slate-200 rounded-xl p-0.5">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => updateStyle({ align: a })}
                className={`flex-1 text-center py-1.5 text-[10px] rounded-lg font-semibold capitalize transition-all ${
                  align === a 
                    ? "bg-white text-slate-800 shadow-sm border border-slate-100" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Line Height select */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-medium pl-0.5">Line Height</span>
          <select
            value={lineHeight}
            onChange={(e) => updateStyle({ lineHeight: Number(e.target.value) })}
            className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-slate-400 focus:outline-none bg-slate-50/50 text-xs text-slate-700"
          >
            <option value="1.0">1.0</option>
            <option value="1.2">1.2</option>
            <option value="1.4">1.4</option>
            <option value="1.6">1.6</option>
            <option value="1.8">1.8</option>
            <option value="2.0">2.0</option>
          </select>
        </div>
      </div>
    </div>
  );
};
