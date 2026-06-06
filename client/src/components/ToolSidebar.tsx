import React, { useState } from "react";
import {
  MousePointer, Hand, Pencil, Square, Circle,
  Minus, ArrowUpRight, Type, Eraser, Box, Diamond,
  ChevronLeft, ChevronRight, MessageSquare,
  Palette
} from "lucide-react";
import type { Tool, Point } from "../lib/types";

interface Props {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  strokeColor: string;
  fillColor: string;
  onStrokeColorChange: (color: string) => void;
  onFillColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  lineStyle?: "solid" | "dashed" | "dotted";
  onLineStyleChange?: (s: "solid" | "dashed" | "dotted") => void;
  arrowStyle?: "default" | "filled" | "none";
  onArrowStyleChange?: (s: "default" | "filled" | "none") => void;
  eraserSize?: number;
  onEraserSizeChange?: (size: number) => void;
  presetColors?: string[];
  recentColors?: string[];
  onOpenLibrary: () => void;
  onAddGuide?: (type: "horizontal" | "vertical", position: number) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  pan?: Point;
  zoom?: number;
}

const ColorPreset = ({ color, isSelected, onClick }: { color: string; isSelected?: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg border-2 transition-all hover:scale-110 ${isSelected ? "border-blue-500 shadow-lg scale-110" : "border-gray-200 hover:border-gray-300"
      }`}
    style={{ backgroundColor: color }}
    title={color}
  />
);

const ToolButton = ({ icon, label, selected, onClick }: { icon: React.ReactNode; label: string; selected?: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    title={label}
    className={`relative p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center group ${selected
        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
  >
    {icon}
    <span className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden sm:block">
      {label}
    </span>
  </button>
);

export const ToolSidebar: React.FC<Props> = ({
  selectedTool,
  setSelectedTool,
  strokeColor,
  fillColor,
  onStrokeColorChange,
  onFillColorChange,
  strokeWidth,
  onStrokeWidthChange,
  opacity,
  onOpacityChange,
  lineStyle = "solid",
  onLineStyleChange,
  arrowStyle = "default",
  onArrowStyleChange,
  eraserSize = 10,
  onEraserSizeChange,
  presetColors = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF"],
  recentColors = [],
  onOpenLibrary,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"style" | null>(null);

  const mainTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "select", icon: <MousePointer size={18} />, label: "Select (V)" },
    { id: "hand", icon: <Hand size={18} />, label: "Pan (H)" },
  ];

  const drawTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pen", icon: <Pencil size={18} />, label: "Pen (P)" },
    { id: "rect", icon: <Square size={18} />, label: "Rectangle (R)" },
    { id: "circle", icon: <Circle size={18} />, label: "Circle (C)" },
    { id: "diamond", icon: <Diamond size={18} />, label: "Diamond" },
    { id: "line", icon: <Minus size={18} />, label: "Line (L)" },
    { id: "arrow", icon: <ArrowUpRight size={18} />, label: "Arrow (A)" },
  ];

  const utilityTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "text", icon: <Type size={18} />, label: "Text (T)" },
    { id: "eraser", icon: <Eraser size={18} />, label: "Eraser (E)" },
    { id: "comment", icon: <MessageSquare size={18} />, label: "Comment" },
  ];

  if (collapsed) {
    return (
      <div className="fixed left-1 sm:left-4 z-30 top-1/2 -translate-y-1/2">
        <button
          onClick={() => setCollapsed(false)}
          className="bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 rounded-full border border-blue-400 w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center hover:shadow-xl transition-all duration-200"
          title="Open toolbar"
        >
          <ChevronRight size={16} className="text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-1 sm:left-4 z-30 top-1/2 -translate-y-1/2 flex flex-col gap-0 bg-white shadow-2xl rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto w-[140px] sm:w-72">
      <div className="sticky top-0 flex items-center justify-between p-2 sm:p-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
        <h3 className="text-[10px] sm:text-sm font-bold text-gray-800">Tools</h3>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 sm:p-1.5 hover:bg-gray-200 rounded-lg transition-all"
          title="Close toolbar"
        >
          <ChevronLeft size={14} className="text-gray-400" />
        </button>
      </div>

      <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
        <div>
          <p className="text-[9px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">Selection</p>
          <div className="grid grid-cols-2 gap-1 sm:gap-2">
            {mainTools.map((tool) => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                selected={selectedTool === tool.id}
                onClick={() => setSelectedTool(tool.id)}
              />
            ))}
          </div>
        </div>

        <div className="pt-1 sm:pt-2">
          <p className="text-[9px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">Drawing</p>
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {drawTools.map((tool) => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                selected={selectedTool === tool.id}
                onClick={() => setSelectedTool(tool.id)}
              />
            ))}
          </div>
        </div>

        <div className="pt-1 sm:pt-2">
          <p className="text-[9px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">Utilities</p>
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {utilityTools.map((tool) => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                selected={selectedTool === tool.id}
                onClick={() => setSelectedTool(tool.id)}
              />
            ))}
            <button
              onClick={onOpenLibrary}
              title="Icon Library"
              className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all flex items-center justify-center ${selectedTool === "icon"
                  ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg"
                  : "text-gray-600 hover:bg-orange-50 hover:text-orange-600"
                }`}
            >
              <Box size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <button
          onClick={() => setExpandedSection(expandedSection === "style" ? null : "style")}
          className="w-full px-2 sm:px-3 py-2 sm:py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <Palette size={14} className="text-blue-600" />
            <span className="text-[10px] sm:text-sm font-semibold text-gray-700">Style</span>
          </div>
          <ChevronRight
            size={14}
            className={`text-gray-400 transition-transform ${expandedSection === "style" ? "rotate-90" : ""}`}
          />
        </button>

        {expandedSection === "style" && (
          <div className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-2 sm:space-y-3 border-t border-gray-200 bg-gray-50">
            <div className="space-y-1.5 sm:space-y-2">
              <div>
                <label className="text-[10px] sm:text-xs font-semibold text-gray-600 block mb-1 sm:mb-1.5">Stroke</label>
                <div className="flex gap-1 sm:gap-2">
                  <div className="flex-1">
                    <input
                      type="color"
                      value={strokeColor}
                      onChange={e => onStrokeColorChange(e.target.value)}
                      className="w-full h-8 sm:h-10 rounded-lg cursor-pointer border border-gray-300 hover:border-gray-400"
                    />
                  </div>
                  <span className="text-[9px] sm:text-xs text-gray-500 flex items-center">{strokeColor}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-semibold text-gray-600 block mb-1 sm:mb-1.5">Fill</label>
                <div className="flex gap-1 sm:gap-2">
                  <div className="flex-1">
                    <input
                      type="color"
                      value={fillColor}
                      onChange={e => onFillColorChange(e.target.value)}
                      className="w-full h-8 sm:h-10 rounded-lg cursor-pointer border border-gray-300 hover:border-gray-400"
                    />
                  </div>
                  <span className="text-[9px] sm:text-xs text-gray-500 flex items-center">{fillColor}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] sm:text-xs font-semibold text-gray-600 block mb-1 sm:mb-1.5">Presets</label>
              <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                {presetColors.slice(0, 12).map((c) => (
                  <ColorPreset
                    key={c}
                    color={c}
                    isSelected={strokeColor === c}
                    onClick={() => onStrokeColorChange(c)}
                  />
                ))}
              </div>
            </div>

            {recentColors.length > 0 && (
              <div>
                <label className="text-[10px] sm:text-xs font-semibold text-gray-600 block mb-1 sm:mb-1.5">Recent</label>
                <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                  {recentColors.slice(0, 12).map((c) => (
                    <ColorPreset
                      key={c}
                      color={c}
                      isSelected={strokeColor === c}
                      onClick={() => onStrokeColorChange(c)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
              <div>
                <div className="flex justify-between items-center mb-1 sm:mb-2">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-600">Width</label>
                  <span className="text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">{strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={strokeWidth}
                  onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 sm:h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1 sm:mb-2">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-600">Opacity</label>
                  <span className="text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">{opacity}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacity}
                  onChange={(e) => onOpacityChange(Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 sm:h-2 rounded-lg cursor-pointer"
                />
              </div>

              {onLineStyleChange && (
                <div>
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-600 block mb-1 sm:mb-1.5">Line Style</label>
                  <select
                    value={lineStyle}
                    onChange={(e) => onLineStyleChange(e.target.value as "solid" | "dashed" | "dotted")}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="solid">Solid ━━━</option>
                    <option value="dashed">Dashed ─ ─ ─</option>
                    <option value="dotted">Dotted ···</option>
                  </select>
                </div>
              )}

              {onArrowStyleChange && selectedTool === "arrow" && (
                <div>
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-600 block mb-1 sm:mb-1.5">Arrow Head</label>
                  <select
                    value={arrowStyle}
                    onChange={(e) => onArrowStyleChange(e.target.value as "default" | "filled" | "none")}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="default">Default →</option>
                    <option value="filled">Filled ▶</option>
                    <option value="none">None —</option>
                  </select>
                </div>
              )}

              {onEraserSizeChange && selectedTool === "eraser" && (
                <div>
                  <div className="flex justify-between items-center mb-1 sm:mb-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-gray-600">Eraser Size</label>
                    <span className="text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">{eraserSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    value={eraserSize}
                    onChange={(e) => onEraserSizeChange(Number(e.target.value))}
                    className="w-full accent-blue-600 h-1.5 sm:h-2 rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};