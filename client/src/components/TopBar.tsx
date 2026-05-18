import React, { useRef } from "react";
import { Undo, Redo, Download, Trash2, AlignStartVertical, AlignEndVertical, AlignCenter, Group, Ungroup, Lock, Unlock, ArrowUp, ArrowDown, Fullscreen, FileImage, FileUp, MessageSquare, Layers, SlidersHorizontal, Layout, Monitor, ZoomIn } from "lucide-react";

interface Props {
  onUndo: () => void; onRedo: () => void; onClear: () => void; onExport: () => void;
  canUndo: boolean; canRedo: boolean;
  // Alignment
  onAlignLeft?: () => void; onAlignCenter?: () => void; onAlignRight?: () => void;
  onAlignTop?: () => void; onAlignMiddle?: () => void; onAlignBottom?: () => void;
  onDistributeH?: () => void; onDistributeV?: () => void;
  // Group
  onGroup?: () => void; onUngroup?: () => void;
  // Z-order
  onBringToFront?: () => void; onSendToBack?: () => void;
  onBringForward?: () => void; onSendBackward?: () => void;
  // Lock
  onToggleLock?: () => void;
  // Export variants
  onExportSVG?: () => void; onExportPDF?: () => void;
  // Selection state
  hasSelection?: boolean; hasMultiSelection?: boolean;
  // Import
  onImportImage?: (file: File) => void;
  // Zoom/View
  onZoomToFit?: () => void; onFullscreen?: () => void;
  // Panels
  onToggleComments?: () => void; onToggleLayers?: () => void;
  onToggleProperties?: () => void; onToggleTemplates?: () => void;
  onPresentation?: () => void;
  // History
  historyIndex?: number; historyLength?: number;
}

export const TopBar: React.FC<Props> = ({ onUndo, onRedo, onClear, onExport, canUndo, canRedo,
  onAlignLeft, onAlignCenter, onAlignRight, onAlignTop, onAlignMiddle, onAlignBottom,
  onDistributeH, onDistributeV, onGroup, onUngroup,
  onBringToFront, onSendToBack, onBringForward, onSendBackward,
  onToggleLock, onExportSVG, onExportPDF,
  hasSelection, hasMultiSelection, onImportImage, onZoomToFit, onFullscreen,
  onToggleComments, onToggleLayers, onToggleProperties, onToggleTemplates, onPresentation,
  historyIndex, historyLength,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-white shadow-xl rounded-2xl border border-gray-200 px-3 py-1.5 flex items-center gap-0.5 z-40 text-xs flex-wrap">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0] && onImportImage) onImportImage(e.target.files[0]); }} />

      <button onClick={onUndo} disabled={!canUndo} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo size={16}/></button>
      <button onClick={onRedo} disabled={!canRedo} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30" title="Redo (Ctrl+Y)"><Redo size={16}/></button>
      {historyIndex !== undefined && historyLength && (
        <span className="text-[9px] text-gray-400 w-8 text-center">{historyIndex+1}/{historyLength}</span>
      )}

      <div className="w-px h-5 bg-gray-200 mx-0.5"/>

      <button onClick={onExport} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg" title="Export PNG (Ctrl+E)"><Download size={16}/></button>
      <button onClick={onExportSVG} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg" title="Export SVG"><FileImage size={16}/></button>
      <button onClick={onExportPDF} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg" title="Export PDF"><FileUp size={16}/></button>
      <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg" title="Import Image"><FileImage size={16}/></button>

      <div className="w-px h-5 bg-gray-200 mx-0.5"/>

      {/* Z-order (improvement 11) */}
      {hasSelection && (<><button onClick={onBringToFront} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Bring to Front (Ctrl+Shift+])"><ArrowUp size={16}/></button>
      <button onClick={onSendToBack} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Send to Back (Ctrl+Shift+[)"><ArrowDown size={16}/></button></>)}

      {/* Lock toggle (improvement 12) */}
      {hasSelection && <button onClick={onToggleLock} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Lock/Unlock"><Lock size={16}/></button>}

      {/* Alignment (improvement 9) */}
      {hasMultiSelection && (<><div className="w-px h-5 bg-gray-200 mx-0.5"/>
        <button onClick={onAlignLeft} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Align Left"><AlignStartVertical size={14} className="rotate-90"/></button>
        <button onClick={onAlignCenter} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Align Center"><AlignCenter size={14}/></button>
        <button onClick={onAlignRight} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Align Right"><AlignEndVertical size={14} className="rotate-90"/></button>
        <button onClick={onAlignTop} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Align Top"><AlignStartVertical size={14}/></button>
        <button onClick={onAlignMiddle} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Align Middle"><AlignCenter size={14} className="rotate-90"/></button>
        <button onClick={onAlignBottom} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Align Bottom"><AlignEndVertical size={14}/></button>
      </>)}

      {/* Group/Ungroup (improvement 10) */}
      {hasMultiSelection && <button onClick={onGroup} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Group (Ctrl+G)"><Group size={16}/></button>}
      {hasSelection && <button onClick={onUngroup} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Ungroup (Ctrl+Shift+G)"><Ungroup size={16}/></button>}

      <div className="w-px h-5 bg-gray-200 mx-0.5"/>

      <button onClick={onPresentation} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Presentation"><Monitor size={16}/></button>
      <button onClick={onZoomToFit} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Zoom to Fit"><ZoomIn size={16}/></button>
      <button onClick={onFullscreen} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Fullscreen (F11)"><Fullscreen size={16}/></button>

      <div className="w-px h-5 bg-gray-200 mx-0.5"/>

      <button onClick={onToggleComments} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Comments"><MessageSquare size={16}/></button>
      <button onClick={onToggleLayers} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Layers"><Layers size={16}/></button>
      <button onClick={onToggleProperties} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Properties"><SlidersHorizontal size={16}/></button>
      <button onClick={onToggleTemplates} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Templates"><Layout size={16}/></button>
    </div>
  );
};