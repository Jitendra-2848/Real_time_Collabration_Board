import React, { useRef } from "react";
import { Undo, Redo, Download, AlignStartVertical, AlignEndVertical, AlignCenter, Group, Ungroup, Lock, ArrowUp, ArrowDown, Fullscreen, FileImage, FileUp, MessageSquare, Layers, SlidersHorizontal, Layout, Monitor, ZoomIn, Type, Wand2 } from "lucide-react";

interface Props {
  onUndo: () => void; onRedo: () => void; onExport: () => void;
  canUndo: boolean; canRedo: boolean;
  onAlignLeft?: () => void; onAlignCenter?: () => void; onAlignRight?: () => void;
  onAlignTop?: () => void; onAlignMiddle?: () => void; onAlignBottom?: () => void;
  onGroup?: () => void; onUngroup?: () => void;
  onBringToFront?: () => void; onSendToBack?: () => void;
  onToggleLock?: () => void;
  onExportSVG?: () => void; onExportPDF?: () => void;
  hasSelection?: boolean; hasMultiSelection?: boolean;
  onImportImage?: (file: File) => void;
  onZoomToFit?: () => void; onFullscreen?: () => void;
  onToggleComments?: () => void; onToggleLayers?: () => void;
  onToggleProperties?: () => void; onToggleTemplates?: () => void;
  onPresentation?: () => void;
  historyIndex?: number; historyLength?: number;
  onCycleTextStyle?: () => void;
  onToggleDiagramEditor?: () => void;
}

export const TopBar: React.FC<Props> = ({ onUndo, onRedo, onExport, canUndo, canRedo,
  onAlignLeft, onAlignCenter, onAlignRight, onAlignTop, onAlignMiddle, onAlignBottom,
  onGroup, onUngroup,
  onBringToFront, onSendToBack,
  onToggleLock, onExportSVG, onExportPDF,
  hasSelection, hasMultiSelection, onImportImage, onZoomToFit, onFullscreen,
  onToggleComments, onToggleLayers, onToggleProperties, onToggleTemplates, onPresentation,
  onCycleTextStyle,
  onToggleDiagramEditor,
  historyIndex, historyLength,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed top-10 left-0 right-0 sm:top-16 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-white shadow-lg sm:shadow-xl rounded-none sm:rounded-2xl border-b sm:border border-gray-200 px-1 sm:px-3 py-1 sm:py-1.5 flex items-center gap-0 sm:gap-0.5 z-40 text-[10px] sm:text-xs overflow-x-auto overflow-y-hidden scrollbar-none justify-start max-w-full sm:max-w-none">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0] && onImportImage) onImportImage(e.target.files[0]); }} />

      <button onClick={onUndo} disabled={!canUndo} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 shrink-0" title="Undo (Ctrl+Z)"><Undo size={14}/></button>
      <button onClick={onRedo} disabled={!canRedo} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 shrink-0" title="Redo (Ctrl+Y)"><Redo size={14}/></button>
      {historyIndex !== undefined && historyLength && (
        <span className="text-[8px] sm:text-[9px] text-gray-400 w-6 sm:w-8 text-center shrink-0">{historyIndex+1}/{historyLength}</span>
      )}

      <div className="w-px h-4 sm:h-5 bg-gray-200 mx-0.5 shrink-0"/>

      <button onClick={onExport} className="p-1 sm:p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg shrink-0" title="Export PNG (Ctrl+E)"><Download size={14}/></button>
      <button onClick={onExportSVG} className="p-1 sm:p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg shrink-0" title="Export SVG"><FileImage size={14}/></button>
      <button onClick={onExportPDF} className="p-1 sm:p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg shrink-0" title="Export PDF"><FileUp size={14}/></button>
      <button onClick={() => fileInputRef.current?.click()} className="p-1 sm:p-1.5 hover:bg-green-50 text-green-600 rounded-lg shrink-0" title="Import Image"><FileImage size={14}/></button>

      <div className="w-px h-4 sm:h-5 bg-gray-200 mx-0.5 shrink-0"/>

      {hasSelection && (<><button onClick={onBringToFront} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Bring to Front (Ctrl+Shift+])"><ArrowUp size={14}/></button>
      <button onClick={onSendToBack} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Send to Back (Ctrl+Shift+[)"><ArrowDown size={14}/></button></>)}

      {hasSelection && <button onClick={onToggleLock} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Lock/Unlock"><Lock size={14}/></button>}

      {hasMultiSelection && (<><div className="w-px h-4 sm:h-5 bg-gray-200 mx-0.5 shrink-0"/>
        <button onClick={onAlignLeft} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Align Left"><AlignStartVertical size={12} className="rotate-90"/></button>
        <button onClick={onAlignCenter} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Align Center"><AlignCenter size={12}/></button>
        <button onClick={onAlignRight} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Align Right"><AlignEndVertical size={12} className="rotate-90"/></button>
        <button onClick={onAlignTop} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Align Top"><AlignStartVertical size={12}/></button>
        <button onClick={onAlignMiddle} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Align Middle"><AlignCenter size={12} className="rotate-90"/></button>
        <button onClick={onAlignBottom} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Align Bottom"><AlignEndVertical size={12}/></button>
      </>)}

      {hasMultiSelection && <button onClick={onGroup} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Group (Ctrl+G)"><Group size={14}/></button>}
      {hasSelection && <button onClick={onUngroup} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Ungroup (Ctrl+Shift+G)"><Ungroup size={14}/></button>}

      <div className="w-px h-4 sm:h-5 bg-gray-200 mx-0.5 shrink-0"/>

      <button onClick={onPresentation} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Presentation"><Monitor size={14}/></button>
      <button onClick={onCycleTextStyle} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Switch text style"><Type size={14}/></button>
      <button onClick={onZoomToFit} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Zoom to Fit"><ZoomIn size={14}/></button>
      <button onClick={onFullscreen} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Fullscreen (F11)"><Fullscreen size={14}/></button>

      <div className="w-px h-4 sm:h-5 bg-gray-200 mx-0.5 shrink-0"/>

      <button onClick={onToggleComments} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Comments"><MessageSquare size={14}/></button>
      <button onClick={onToggleLayers} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Layers"><Layers size={14}/></button>
      <button onClick={onToggleProperties} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Properties"><SlidersHorizontal size={14}/></button>
      <button onClick={onToggleTemplates} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Templates"><Layout size={14}/></button>
      <button onClick={onToggleDiagramEditor} className="p-1 sm:p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg shrink-0" title="Diagram-as-Code"><Wand2 size={14}/></button>
    </div>
  );
};