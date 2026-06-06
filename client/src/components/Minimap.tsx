import React, { useEffect, useRef } from "react";
import type { Element, Point } from "../lib/types";

interface Props {
  elements: Element[];
  pan: Point;
  zoom: number;
  width?: number;
  height?: number;
}

export const Minimap: React.FC<Props> = ({ elements, pan, zoom, width = 192, height = 144 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      minX = Math.min(minX, el.x || 0);
      minY = Math.min(minY, el.y || 0);
      maxX = Math.max(maxX, (el.x || 0) + (el.width || 0));
      maxY = Math.max(maxY, (el.y || 0) + (el.height || 0));
    });
    if (minX === Infinity) { minX = 0; minY = 0; maxX = width; maxY = height; }

    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);

    const scale = Math.min(width / worldW, height / worldH) * 0.95;
    const offsetX = (width - worldW * scale) / 2 - minX * scale;
    const offsetY = (height - worldH * scale) / 2 - minY * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    elements.forEach(el => {
      if (!el) return;
      ctx.beginPath();
      ctx.strokeStyle = el.color || "#000";
      ctx.lineWidth = Math.max(1 / scale, 0.5);
      if (el.width && el.height) {
        ctx.strokeRect(el.x || 0, el.y || 0, el.width, el.height);
      } else if (el.points && el.points.length) {
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
        ctx.stroke();
      }
    });
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(59,130,246,0.8)";
    ctx.lineWidth = 2;
    const vw = (window.innerWidth) / zoom;
    const vh = (window.innerHeight) / zoom;
    const vx = -pan.x / zoom;
    const vy = -pan.y / zoom;
    const rx = vx * scale + offsetX;
    const ry = vy * scale + offsetY;
    const rw = vw * scale;
    const rh = vh * scale;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }, [elements, pan, zoom, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full h-full opacity-80" />;
};

export default Minimap;
