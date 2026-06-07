import React, { useRef, useEffect, useState } from "react";
import type { Element, Point, Guide, Comment, Connector, FontDrawStyle, TextElement } from "../lib/types";
import { renderLayers, renderTextElements } from "../lib/renderer";
import type { CanvasLayers } from "../lib/renderer";

interface Props {
  elements: Element[];
  connectors?: Connector[];
  textElements?: TextElement[];
  pan: Point;
  zoom: number;
  showGrid: boolean;
  rubberBand: { x1: number; y1: number; x2: number; y2: number } | null;
  bgTheme?: "white"|"light-grid"|"dark"|"dark-grid";
  guides?: Guide[];
  comments?: Comment[];
  defaultTextStyle?: FontDrawStyle;
  editingElementId?: string | null;
  editingTextElementId?: string | null;
  editingText?: string;
  editingTextElementText?: string;
  caretIndex?: number;
  connectionPreview?: { sourceId: string; sourceAnchor: string; targetId: string | null; mousePos: Point } | null;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  cursor: string;
}

export const Canvas = React.forwardRef<HTMLCanvasElement, Props>(
  ({ elements, connectors = [], textElements = [], pan, zoom, showGrid, rubberBand, bgTheme = "light-grid", guides = [], comments = [],
     defaultTextStyle = "rough", editingElementId = null, editingTextElementId = null, editingText = "", editingTextElementText = "", caretIndex = 0, connectionPreview = null,
     onMouseDown, onMouseMove, onMouseUp, onDoubleClick, onContextMenu,
     onTouchStart, onTouchMove, onTouchEnd, cursor }, ref) => {

    const bgLayerRef = useRef<HTMLCanvasElement>(null);
    const connLayerRef = useRef<HTMLCanvasElement>(null);
    const nodeLayerRef = useRef<HTMLCanvasElement>(null);
    const overlayLayerRef = useRef<HTMLCanvasElement>(null);

    const [caretVisible, setCaretVisible] = useState(true);

    useEffect(() => {
      if (!editingElementId && !editingTextElementId) {
        setCaretVisible(false);
        return;
      }
      setCaretVisible(true);
      const interval = setInterval(() => {
        setCaretVisible((v) => !v);
      }, 500);
      return () => clearInterval(interval);
    }, [editingElementId, editingTextElementId]);

    useEffect(() => {
      const background = bgLayerRef.current;
      const connectorsLayer = connLayerRef.current;
      const nodesLayer = nodeLayerRef.current;
      const overlay = overlayLayerRef.current;
      if (!background || !connectorsLayer || !nodesLayer || !overlay) return;

      const layers: CanvasLayers = {
        background,
        connectors: connectorsLayer,
        nodes: nodesLayer,
        overlays: overlay,
      };
      renderLayers(layers, elements, connectors, pan, zoom, showGrid, bgTheme, guides, comments, rubberBand, connectionPreview, defaultTextStyle, editingElementId, editingText, caretVisible, caretIndex, textElements);
      
      // Render text elements on nodes layer
      if (textElements && textElements.length > 0) {
        const nodeCtx = nodesLayer.getContext("2d");
        if (nodeCtx) {
          nodeCtx.save();
          nodeCtx.translate(pan.x, pan.y);
          nodeCtx.scale(zoom, zoom);
          renderTextElements(nodeCtx, textElements, zoom, defaultTextStyle, editingTextElementId, editingTextElementText, caretVisible, caretIndex, pan);
          nodeCtx.restore();
        }
      }
    }, [elements, connectors, textElements, pan, zoom, showGrid, bgTheme, guides, comments, rubberBand, connectionPreview, defaultTextStyle, editingElementId, editingTextElementId, editingText, editingTextElementText, caretVisible, caretIndex]);

    useEffect(() => {
      if (!nodeLayerRef.current) return;
      if (typeof ref === "function") ref(nodeLayerRef.current);
      else if (ref && "current" in ref) (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = nodeLayerRef.current;
    }, [ref]);

    return (
      <div className="absolute inset-0 z-0" style={{ touchAction: "none" }}>
        <canvas ref={bgLayerRef} className="absolute inset-0 block" style={{ touchAction: "none", pointerEvents: "none" }} />
        <canvas ref={connLayerRef} className="absolute inset-0 block" style={{ touchAction: "none", pointerEvents: "none" }} />
        <canvas ref={nodeLayerRef}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
          onDoubleClick={(e) => { if (e.target === e.currentTarget) onDoubleClick?.(e); }}
          onContextMenu={onContextMenu} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          className="absolute inset-0 block touch-none"
          style={{ cursor, touchAction: "none", overscrollBehavior: "none", userSelect: "none" }} />
        <canvas ref={overlayLayerRef} className="absolute inset-0 block" style={{ touchAction: "none", pointerEvents: "none" }} />
      </div>
    );
  }
);