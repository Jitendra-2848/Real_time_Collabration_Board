import React, { useRef, useEffect, forwardRef } from "react";
import type { Element, Point } from "../lib/types";
import { drawGrid, renderElement } from "../lib/renderer";

interface Props {
  elements: Element[];
  pan: Point;
  zoom: number;
  showGrid: boolean;
  width: number;
  height: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  cursor: string;
}

export const Canvas = forwardRef<HTMLCanvasElement, Props>(
  (
    {
      elements,
      pan,
      zoom,
      showGrid,
      width,
      height,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onWheel,
      cursor,
    },
    ref
  ) => {
    const internalRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = internalRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      let frame = requestAnimationFrame(() => {
        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);

        if (showGrid) {
          drawGrid(ctx, width, height, pan, zoom);
        }

        elements.forEach((el) => renderElement(ctx, el, zoom));

        ctx.restore();
      });

      return () => cancelAnimationFrame(frame);
    }, [elements, pan, zoom, showGrid, width, height]);

    return (
      <canvas
        ref={(node) => {
          internalRef.current = node;

          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="block touch-none"
        style={{
          cursor,
          touchAction: "none",
          overscrollBehavior: "none",
        }}
      />
    );
  }
);

Canvas.displayName = "Canvas";