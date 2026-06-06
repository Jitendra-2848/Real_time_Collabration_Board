import React from "react";
import { ZoomIn, ZoomOut, Maximize, Grid, Map, Settings, Check } from "lucide-react";

interface Props {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  onZoomToFit: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  bgTheme?: "white" | "light-grid" | "dark" | "dark-grid";
  onBgThemeChange?: (theme: "white" | "light-grid" | "dark" | "dark-grid") => void;
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
  bgTheme,
  onBgThemeChange,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-2xl border border-slate-200/50 bg-white/85 p-2 shadow-xl backdrop-blur-md transition-all duration-300 select-none">
      <button
        onClick={onZoomOut}
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-700 hover:text-slate-900 active:scale-95"
        title="Zoom Out"
      >
        <ZoomOut size={15} />
      </button>
      <span className="font-mono text-[10px] w-12 text-center text-slate-600 font-semibold select-none">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-700 hover:text-slate-900 active:scale-95"
        title="Zoom In"
      >
        <ZoomIn size={15} />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Settings Dropdown Container */}
      <div className="relative flex items-center" ref={dropdownRef}>
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-2 rounded-xl transition-all active:scale-95 flex items-center justify-center ${
            isSettingsOpen ? "bg-slate-900 text-white shadow-md" : "hover:bg-slate-100 text-slate-600"
          }`}
          title="Canvas Settings"
        >
          <Settings size={15} />
        </button>

        {isSettingsOpen && (
          <div className="absolute bottom-12 right-0 w-56 rounded-2xl border border-slate-200/50 bg-white p-3 shadow-2xl backdrop-blur-lg flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 pt-1 mb-1">Canvas Options</h4>
            
            <button
              onClick={() => { onToggleGrid(); setIsSettingsOpen(false); }}
              className={`flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl text-left transition-all ${
                showGrid ? "bg-slate-50 text-slate-900" : "hover:bg-slate-50 text-slate-600"
              }`}
            >
              <span className="flex items-center gap-2"><Grid size={13} /> Grid Background</span>
              {showGrid && <Check size={12} className="text-slate-900" />}
            </button>

            <button
              onClick={() => { onToggleMinimap(); setIsSettingsOpen(false); }}
              className={`flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl text-left transition-all ${
                showMinimap ? "bg-slate-50 text-slate-900" : "hover:bg-slate-50 text-slate-600"
              }`}
            >
              <span className="flex items-center gap-2"><Map size={13} /> Navigation Map</span>
              {showMinimap && <Check size={12} className="text-slate-900" />}
            </button>

            <button
              onClick={() => { onZoomToFit(); setIsSettingsOpen(false); }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl text-left transition-all"
            >
              <Maximize size={13} /> Zoom to Fit
            </button>

            {bgTheme && onBgThemeChange && (
              <>
                <div className="w-full h-px bg-slate-100 my-1" />
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 mb-1">Background Style</h4>
                <div className="grid grid-cols-2 gap-1.5 p-1">
                  {(["white", "light-grid", "dark", "dark-grid"] as const).map((theme) => {
                    const isActive = bgTheme === theme;
                    return (
                      <button
                        key={theme}
                        onClick={() => { onBgThemeChange(theme); setIsSettingsOpen(false); }}
                        className={`px-2 py-1 text-[10px] font-bold capitalize rounded-lg border text-center transition-all ${
                          isActive 
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {theme.replace("-", " ")}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
