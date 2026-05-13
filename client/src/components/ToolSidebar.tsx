import React from "react";
import {
  MousePointer,
  Hand,
  Pencil,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Type,
  Eraser,
  Box,
  Diamond,
} from "lucide-react";
import type { Tool } from "../lib/types";

interface Props {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  onStrokeColorChange: (color: string) => void;
  onFillColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onOpenLibrary: () => void;
}

export const ToolSidebar: React.FC<Props> = ({
  selectedTool,
  setSelectedTool,
  strokeColor,
  fillColor,
  strokeWidth,
  onStrokeColorChange,
  onFillColorChange,
  onStrokeWidthChange,
  onOpenLibrary,
}) => {
  const tools: {
    id: Tool;
    icon: React.ReactNode;
    label: string;
    shortcut: string;
  }[] = [
    { id: "select", icon: <MousePointer size={15} />, label: "Select", shortcut: "V" },
    { id: "hand", icon: <Hand size={15} />, label: "Pan", shortcut: "H" },
    { id: "pen", icon: <Pencil size={15} />, label: "Pen", shortcut: "P" },
    { id: "rect", icon: <Square size={15} />, label: "Rectangle", shortcut: "R" },
    { id: "circle", icon: <Circle size={15} />, label: "Circle", shortcut: "C" },
    { id: "diamond", icon: <Diamond size={15} />, label: "Diamond", shortcut: "D" },
    { id: "arrow", icon: <ArrowUpRight size={15} />, label: "Arrow", shortcut: "A" },
    { id: "line", icon: <Minus size={15} />, label: "Line", shortcut: "L" },
    { id: "text", icon: <Type size={15} />, label: "Text", shortcut: "T" },
    { id: "eraser", icon: <Eraser size={15} />, label: "Delete Eraser", shortcut: "E" },
    { id: "soft-eraser", icon: <Eraser size={13} />, label: "Soft Eraser", shortcut: "S" },
  ];

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-30 max-h-[82vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
      <div className="flex flex-col gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            className={`relative rounded-lg p-2 transition-all ${
              selectedTool === tool.id
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tool.icon}

            <span className="absolute bottom-[1px] right-[2px] text-[7px] opacity-50">
              {tool.shortcut}
            </span>
          </button>
        ))}

        <hr className="my-1 border-gray-200" />

        <button
          onClick={onOpenLibrary}
          className="rounded-lg p-2 text-orange-600 transition-all hover:bg-orange-50"
          title="Icon Library"
        >
          <Box size={15} />
        </button>

        <hr className="my-1 border-gray-200" />

        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-col items-center">
            <label className="mb-1 text-[8px] text-gray-500">Stroke</label>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => onStrokeColorChange(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border"
            />
          </div>

          <div className="flex flex-col items-center">
            <label className="mb-1 text-[8px] text-gray-500">Fill</label>
            <input
              type="color"
              value={fillColor}
              onChange={(e) => onFillColorChange(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border"
            />
          </div>

          <div className="flex flex-col items-center">
            <label className="mb-1 text-[8px] text-gray-500">Width</label>
            <input
              type="range"
              min={1}
              max={20}
              value={strokeWidth}
              onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
              className="w-12"
            />
            <span className="text-[8px] text-gray-500">{strokeWidth}px</span>
          </div>
        </div>
      </div>
    </div>
  );
};