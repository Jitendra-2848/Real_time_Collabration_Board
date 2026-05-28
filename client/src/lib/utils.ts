import type { Element, Point } from "./types";

// Convert screen coordinates to canvas world coordinates
export const screenToCanvas = (
  screenX: number,
  screenY: number,
  canvas: HTMLCanvasElement,
  pan: Point,
  zoom: number
): Point => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (screenX - rect.left - pan.x) / zoom,
    y: (screenY - rect.top - pan.y) / zoom,
  };
};

// Check if point hits element
export const isPointInElement = (x: number, y: number, el: Element): boolean => {
  if (el.tool === "pen" && el.points) {
    return el.points.some(p => 
      Math.hypot(p.x - x, p.y - y) < 10 / 1 // Adjust hit tolerance
    );
  }
  const minX = Math.min(el.x, el.x + el.width);
  const maxX = Math.max(el.x, el.x + el.width);
  const minY = Math.min(el.y, el.y + el.height);
  const maxY = Math.max(el.y, el.y + el.height);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
};

// Get bounding box for selection
export const getBoundingBox = (el: Element) => {
  if (el.tool === "pen" && el.points && el.points.length > 0) {
    const xs = el.points.map(p => p.x);
    const ys = el.points.map(p => p.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }
  return { x: el.x, y: el.y, width: el.width, height: el.height };
};

// Distance from point to line segment (for eraser)
export const distanceToSegment = (
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

export const getElementBounds = (el: Element) => {
    if (el.tool === "pen" && el.points && el.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      el.points.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      });
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    return { x: el.width < 0 ? el.x + el.width : el.x, y: el.height < 0 ? el.y + el.height : el.y, width: Math.abs(el.width), height: Math.abs(el.height) };
  };