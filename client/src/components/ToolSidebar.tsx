import React, { useState } from "react";
import {
  MousePointer, Hand, Pencil, Square, Circle, 
  Minus, ArrowUpRight, Type, Eraser, Box, Diamond,
  ChevronLeft, ChevronRight
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
  onAddGuide?: (type: "horizontal" | "vertical", position: number) => void;
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
  onOpenLibrary,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const mainTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "select", icon: <MousePointer size={20} />, label: "Select (V)" },
    { id: "hand", icon: <Hand size={20} />, label: "Pan (H)" },
  ];

  const drawTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pen", icon: <Pencil size={20} />, label: "Pen (P)" },
    { id: "rect", icon: <Square size={20} />, label: "Rectangle (R)" },
    { id: "circle", icon: <Circle size={20} />, label: "Circle (C)" },
    { id: "diamond", icon: <Diamond size={20} />, label: "Diamond" },
    { id: "arrow", icon: <ArrowUpRight size={20} />, label: "Arrow (A)" },
    { id: "line", icon: <Minus size={20} />, label: "Line (L)" },
  ];

  const utilityTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "text", icon: <Type size={20} />, label: "Text (T)" },
    { id: "eraser", icon: <Eraser size={20} />, label: "Eraser (E)" },
  ];

  if (collapsed) {
    return (
      <div className="fixed left-2 z-30 top-1/2 -translate-y-1/2">
        <button onClick={() => setCollapsed(false)}
          className="bg-white shadow-xl rounded-full border border-gray-200 w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-all"
          title="Open toolbar">
          <ChevronRight size={18} className="text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-2 z-30 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 p-2 bg-white shadow-2xl rounded-2xl border border-gray-200 w-20">
      
      {/* Collapse button */}
      <button onClick={() => setCollapsed(true)}
        className="p-1.5 hover:bg-gray-100 rounded-xl flex justify-center mb-1 transition-all"
        title="Close toolbar">
        <ChevronLeft size={16} className="text-gray-400" />
      </button>

      <div className="text-[8px] text-gray-400 text-center font-medium mb-0.5">MAIN</div>
      {mainTools.map((tool) => (
        <button key={tool.id} onClick={() => setSelectedTool(tool.id)} title={tool.label}
          className={`p-2 rounded-xl transition-all flex justify-center ${
            selectedTool === tool.id ? "bg-blue-600 text-white shadow-lg scale-105" : "hover:bg-gray-100 text-gray-700"
          }`}>
          {tool.icon}
        </button>
      ))}

      <hr className="my-1 border-gray-200" />
      <div className="text-[8px] text-gray-400 text-center font-medium mb-0.5">DRAW</div>
      {drawTools.map((tool) => (
        <button key={tool.id} onClick={() => setSelectedTool(tool.id)} title={tool.label}
          className={`p-2 rounded-xl transition-all flex justify-center ${
            selectedTool === tool.id ? "bg-blue-600 text-white shadow-lg scale-105" : "hover:bg-gray-100 text-gray-700"
          }`}>
          {tool.icon}
        </button>
      ))}

      <hr className="my-1 border-gray-200" />
      <div className="text-[8px] text-gray-400 text-center font-medium mb-0.5">UTILITY</div>
      {utilityTools.map((tool) => (
        <button key={tool.id} onClick={() => setSelectedTool(tool.id)} title={tool.label}
          className={`p-2 rounded-xl transition-all flex justify-center ${
            selectedTool === tool.id ? "bg-blue-600 text-white shadow-lg scale-105" : "hover:bg-gray-100 text-gray-700"
          }`}>
          {tool.icon}
        </button>
      ))}

      <button onClick={onOpenLibrary} title="Icon Library"
        className={`p-2 rounded-xl transition-all flex justify-center ${selectedTool === "icon" ? "bg-blue-600 text-white shadow-lg" : "hover:bg-orange-50 text-orange-600"}`}>
        <Box size={20} />
      </button>

      {/* Style Controls */}
      <hr className="my-1 border-gray-200" />
      
      <div className="flex flex-col gap-1.5 mt-1 px-1">
        <div className="flex flex-col items-center gap-0.5">
          <label className="text-[8px] text-gray-500">Stroke</label>
          <input type="color" value={strokeColor} onChange={e => onStrokeColorChange(e.target.value)} className="w-7 h-7 cursor-pointer rounded border p-0.5" />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <label className="text-[8px] text-gray-500">Fill</label>
          <input type="color" value={fillColor} onChange={e => onFillColorChange(e.target.value)} className="w-7 h-7 cursor-pointer rounded border p-0.5" />
        </div>

        <div className="grid grid-cols-3 gap-0.5">
          {presetColors.slice(0, 6).map(c => (
            <button key={c} onClick={() => onStrokeColorChange(c)} className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{backgroundColor: c}} />
          ))}
        </div>

        {recentColors.length > 0 && (
          <div className="grid grid-cols-3 gap-0.5 mt-1">
            {recentColors.slice(0, 6).map(c => (
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