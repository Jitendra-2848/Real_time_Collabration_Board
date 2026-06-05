import React from "react";
import { ZoomIn, ZoomOut, Maximize, Grid, Map } from "lucide-react";

interface Props {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  onZoomToFit: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
}

export const ZoomControls: React.FC<Props> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  showGrid,
  onToggleGrid,
  onZoomToFit,
  showMinimap,
  onToggleMinimap,
}) => {
  return (
    <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-2xl border border-slate-200/50 bg-white/85 p-2 shadow-xl backdrop-blur-md transition-all duration-300">
      <button
        onClick={onZoomIn}
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-700 hover:text-slate-900 active:scale-95"
        title="Zoom In"
      >
        <ZoomIn size={15} />
      </button>
      <span className="font-mono text-[10px] w-12 text-center text-slate-600 font-semibold select-none">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomOut}
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-700 hover:text-slate-900 active:scale-95"
        title="Zoom Out"
      >
        <ZoomOut size={15} />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <button
        onClick={onToggleGrid}
        className={`p-2 rounded-xl transition-all active:scale-95 flex items-center gap-1 text-[10px] font-semibold ${
          showGrid
            ? "bg-slate-900 text-white shadow-md"
            : "hover:bg-slate-100 text-slate-600"
        }`}
        title="Toggle Grid"
      >
        <Grid size={13} />
        Grid
      </button>

      <button
        onClick={onZoomToFit}
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 hover:text-slate-900 active:scale-95 flex items-center gap-1 text-[10px] font-semibold"
        title="Zoom to Fit"
      >
        <Maximize size={13} />
        Fit
      </button>

      <button
        onClick={onToggleMinimap}
        className={`p-2 rounded-xl transition-all active:scale-95 flex items-center gap-1 text-[10px] font-semibold ${
          showMinimap
            ? "bg-slate-900 text-white shadow-md"
            : "hover:bg-slate-100 text-slate-600"
        }`}
        title="Toggle Minimap"
      >
        <Map size={13} />
        Map
      </button>
    </div>
  );
};
