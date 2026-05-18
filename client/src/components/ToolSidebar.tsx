import React, { useState } from "react";
import {
  MousePointer, Hand, Pencil, Square, Circle, 
  Minus, ArrowUpRight, Type, Eraser, Box, Diamond,
  Droplets, StickyNote, Highlighter, Ruler
} from "lucide-react";
import type { Tool, Point } from "../lib/types";

interface Props {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  strokeColor: string; fillColor: string;
  onStrokeColorChange: (color: string) => void; onFillColorChange: (color: string) => void;
  strokeWidth: number; onStrokeWidthChange: (width: number) => void;
  opacity: number; onOpacityChange: (opacity: number) => void;
  lineStyle?: "solid"|"dashed"|"dotted"; onLineStyleChange?: (s: "solid"|"dashed"|"dotted") => void;
  arrowStyle?: "default"|"filled"|"none"; onArrowStyleChange?: (s: "default"|"filled"|"none") => void;
  eraserSize?: number; onEraserSizeChange?: (size: number) => void;
  presetColors?: string[]; recentColors?: string[];
  onOpenLibrary: () => void;
  onAddGuide?: (type: "horizontal"|"vertical", pos: number) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  pan?: Point; zoom?: number;
}

export const ToolSidebar: React.FC<Props> = ({
  selectedTool, setSelectedTool,
  strokeColor, fillColor, onStrokeColorChange, onFillColorChange,
  strokeWidth, onStrokeWidthChange, opacity, onOpacityChange,
  lineStyle = "solid", onLineStyleChange, arrowStyle = "default", onArrowStyleChange,
  eraserSize = 10, onEraserSizeChange,
  presetColors = [], recentColors = [],
  onOpenLibrary, onAddGuide, canvasRef, pan, zoom,
}) => {
  const [showFlowchart, setShowFlowchart] = useState(false);
  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "select", icon: <MousePointer size={18} />, label: "Select (V)" },
    { id: "hand", icon: <Hand size={18} />, label: "Pan (H)" },
    { id: "pen", icon: <Pencil size={18} />, label: "Pen (P)" },
    { id: "rect", icon: <Square size={18} />, label: "Rectangle (R)" },
    { id: "circle", icon: <Circle size={18} />, label: "Circle (C)" },
    { id: "diamond", icon: <Diamond size={18} />, label: "Diamond" },
    { id: "arrow", icon: <ArrowUpRight size={18} />, label: "Arrow (A)" },
    { id: "line", icon: <Minus size={18} />, label: "Line (L)" },
    { id: "text", icon: <Type size={18} />, label: "Text (T)" },
    { id: "eraser", icon: <Eraser size={18} />, label: "Eraser (E)" },
    { id: "eyedropper", icon: <Droplets size={18} />, label: "Eyedropper" },
    { id: "sticky", icon: <StickyNote size={18} />, label: "Sticky Note" },
    { id: "highlighter", icon: <Highlighter size={18} />, label: "Highlighter" },
  ];

  return (
    <div className="fixed left-2 z-30 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 p-1.5 bg-white shadow-2xl rounded-2xl border border-gray-200 w-14">
      {tools.map((tool) => (
        <button key={tool.id} onClick={() => setSelectedTool(tool.id)} title={tool.label}
          className={`p-2 rounded-xl transition-all flex justify-center ${
            selectedTool === tool.id ? "bg-blue-600 text-white shadow-lg" : "hover:bg-gray-100 text-gray-700"
          }`}>
          {tool.icon}
        </button>
      ))}

      <hr className="my-1 border-gray-200" />

      <button onClick={onOpenLibrary} className="p-2 hover:bg-orange-50 rounded-xl text-orange-600 transition-all flex justify-center" title="Component Library">
        <Box size={18} />
      </button>

      <button onClick={() => onAddGuide?.("horizontal", 100)} className="p-2 hover:bg-gray-100 rounded-xl flex justify-center" title="Add Guide">
        <Ruler size={18} />
      </button>

      <div className="flex flex-col gap-1.5 mt-1 px-1">
        <div className="flex flex-col items-center gap-0.5">
          <label className="text-[8px] text-gray-500">Stroke</label>
          <input type="color" value={strokeColor} onChange={e => onStrokeColorChange(e.target.value)} className="w-7 h-7 cursor-pointer rounded border p-0.5" />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <label className="text-[8px] text-gray-500">Fill</label>
          <input type="color" value={fillColor} onChange={e => onFillColorChange(e.target.value)} className="w-7 h-7 cursor-pointer rounded border p-0.5" />
        </div>

        {/* Preset colors (improvement 15) */}
        <div className="grid grid-cols-3 gap-0.5">
          {presetColors.map(c => (
            <button key={c} onClick={() => onStrokeColorChange(c)} className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{backgroundColor: c}} />
          ))}
        </div>

        {/* Recent colors */}
        {recentColors.length > 0 && (
          <div className="grid grid-cols-3 gap-0.5">
            {recentColors.map(c => (
              <button key={c} onClick={() => onStrokeColorChange(c)} className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{backgroundColor: c}} />
            ))}
          </div>
        )}

        <div className="flex flex-col items-center gap-0.5">
          <label className="text-[8px] text-gray-500">W {strokeWidth}px</label>
          <input type="range" min={1} max={20} value={strokeWidth} onChange={e => onStrokeWidthChange(Number(e.target.value))} className="w-full accent-blue-600 h-1" />
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <label className="text-[8px] text-gray-500">Op {opacity}%</label>
          <input type="range" min={0} max={100} value={opacity} onChange={e => onOpacityChange(Number(e.target.value))} className="w-full accent-blue-600 h-1" />
        </div>

        {/* Line style (improvement 17) */}
        {onLineStyleChange && (
          <div className="flex flex-col items-center gap-0.5">
            <label className="text-[8px] text-gray-500">Line</label>
<select value={lineStyle} onChange={e => onLineStyleChange(e.target.value as "solid" | "dashed" | "dotted")} className="text-[9px] w-full border rounded p-0.5">
              <option value="solid">—</option>
              <option value="dashed">- -</option>
              <option value="dotted">···</option>
            </select>
          </div>
        )}

        {/* Arrow style (improvement 18) */}
        {onArrowStyleChange && selectedTool === "arrow" && (
          <div className="flex flex-col items-center gap-0.5">
            <label className="text-[8px] text-gray-500">Arrow</label>
<select value={arrowStyle} onChange={e => onArrowStyleChange(e.target.value as "default" | "filled" | "none")} className="text-[9px] w-full border rounded p-0.5">
              <option value="default">Default</option>
              <option value="filled">Filled</option>
              <option value="none">None</option>
            </select>
          </div>
        )}

        {/* Eraser size (improvement 39) */}
        {onEraserSizeChange && selectedTool === "eraser" && (
          <div className="flex flex-col items-center gap-0.5">
            <label className="text-[8px] text-gray-500">E {eraserSize}px</label>
            <input type="range" min={5} max={50} value={eraserSize} onChange={e => onEraserSizeChange(Number(e.target.value))} className="w-full accent-blue-600 h-1" />
          </div>
        )}
      </div>
    </div>
  );
};