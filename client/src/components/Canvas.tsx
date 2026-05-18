import React, { useRef, useEffect } from "react";
import type { Element, Point, Guide, Comment } from "../lib/types";
import { drawGrid, renderElement } from "../lib/renderer";

interface Props {
  elements: Element[];
  pan: Point;
  zoom: number;
  showGrid: boolean;
  rubberBand: { x1: number; y1: number; x2: number; y2: number } | null;
  bgTheme?: "white"|"light-grid"|"dark"|"dark-grid";
  guides?: Guide[];
  comments?: Comment[];
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
  ({ elements, pan, zoom, showGrid, rubberBand, bgTheme = "light-grid", guides = [], comments = [],
     onMouseDown, onMouseMove, onMouseUp, onDoubleClick, onContextMenu,
     onTouchStart, onTouchMove, onTouchEnd, cursor }, ref) => {

    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>).current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Background fill
      if (bgTheme === "dark" || bgTheme === "dark-grid") {
        ctx.fillStyle = "#1a1a2e"; ctx.fillRect(-10000, -10000, 20000, 20000);
      } else {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-10000, -10000, 20000, 20000);
      }

      if (showGrid && (bgTheme === "light-grid" || bgTheme === "dark-grid")) {
        drawGrid(ctx, canvas.width, canvas.height, pan, zoom);
      } else if (!showGrid && bgTheme === "light-grid") {
        // Grid intentionally hidden
      }

      // Draw guides (improvement 14)
      guides.forEach(g => {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([4/zoom, 4/zoom]);
        ctx.beginPath();
        if (g.type === "horizontal") { ctx.moveTo(-10000, g.position); ctx.lineTo(10000, g.position); }
        else { ctx.moveTo(g.position, -10000); ctx.lineTo(g.position, 10000); }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      elements.forEach((el) => renderElement(ctx, el, zoom));

      // Draw comment markers (improvement 40)
      comments.filter(c => !c.resolved).forEach((c, i) => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 10/zoom, 0, Math.PI*2);
        ctx.fillStyle = "#facc15"; ctx.fill();
        ctx.strokeStyle = "#ca8a04"; ctx.lineWidth = 1.5/zoom; ctx.stroke();
        ctx.fillStyle = "#000"; ctx.font = `${10/zoom}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${i+1}`, c.x, c.y);
      });

      // Rubber-band
      if (rubberBand) {
        const x = Math.min(rubberBand.x1, rubberBand.x2), y = Math.min(rubberBand.y1, rubberBand.y2);
        const w = Math.abs(rubberBand.x2 - rubberBand.x1), h = Math.abs(rubberBand.y2 - rubberBand.y1);
        ctx.fillStyle = "rgba(59,130,246,0.1)"; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5/zoom;
        ctx.setLineDash([4/zoom,4/zoom]); ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); ctx.setLineDash([]);
      }

      ctx.restore();
    }, [elements, pan, zoom, showGrid, rubberBand, bgTheme, guides, comments, ref]);

    return (
      <canvas ref={ref}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        className="block touch-none"
        style={{ cursor, touchAction: "none", overscrollBehavior: "none", userSelect: "none" }}
      />
    );
  }
);