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

export const getEdgeAnchors = (el: Element) => {
  if (el.tool === "line" || el.tool === "arrow") {
    return [
      { x: el.x, y: el.y, side: "start" as const },
      { x: el.x + el.width, y: el.y + el.height, side: "end" as const },
    ];
  }
  
  const bx = el.width < 0 ? el.x + el.width : el.x;
  const by = el.height < 0 ? el.y + el.height : el.y;
  const bw = Math.abs(el.width);
  const bh = Math.abs(el.height);
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  
  return [
    { x: cx, y: by, side: "top" as const },
    { x: cx, y: by + bh, side: "bottom" as const },
    { x: bx, y: cy, side: "left" as const },
    { x: bx + bw, y: cy, side: "right" as const },
  ];
};

export const findBestAnchors = (source: Element, target: Element) => {
  const sAnchors = getEdgeAnchors(source);
  const tAnchors = getEdgeAnchors(target);
  let best = { s: sAnchors[0], t: tAnchors[0], dist: Infinity };
  
  for (const sa of sAnchors) {
    for (const ta of tAnchors) {
      const dist = Math.hypot(sa.x - ta.x, sa.y - ta.y);
      if (dist < best.dist) {
        best = { s: sa, t: ta, dist };
      }
    }
  }
  
  return best;
};

export const getConnectorControlPoints = (sourceAnchor: { x: number, y: number, side: string }, targetAnchor: { x: number, y: number, side: string }) => {
  const sourceX = sourceAnchor.x;
  const sourceY = sourceAnchor.y;
  const targetX = targetAnchor.x;
  const targetY = targetAnchor.y;
  
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.hypot(dx, dy);
  
  let cp1x = sourceX;
  let cp1y = sourceY;
  let cp2x = targetX;
  let cp2y = targetY;
  
  const forceMag = Math.max(dist * 0.4, 40); 

  if (sourceAnchor.side === "right") cp1x = sourceX + forceMag;
  else if (sourceAnchor.side === "left") cp1x = sourceX - forceMag;
  else if (sourceAnchor.side === "bottom") cp1y = sourceY + forceMag;
  else if (sourceAnchor.side === "top") cp1y = sourceY - forceMag;
  else if (sourceAnchor.side === "start") { cp1x = sourceX + (dx * 0.3); cp1y = sourceY + (dy * 0.3); }
  else if (sourceAnchor.side === "end") { cp1x = sourceX - (dx * 0.3); cp1y = sourceY - (dy * 0.3); }

  if (targetAnchor.side === "right") cp2x = targetX + forceMag;
  else if (targetAnchor.side === "left") cp2x = targetX - forceMag;
  else if (targetAnchor.side === "bottom") cp2y = targetY + forceMag;
  else if (targetAnchor.side === "top") cp2y = targetY - forceMag;
  else if (targetAnchor.side === "start") { cp2x = targetX + (dx * 0.3); cp2y = targetY + (dy * 0.3); }
  else if (targetAnchor.side === "end") { cp2x = targetX - (dx * 0.3); cp2y = targetY - (dy * 0.3); }

  return { cp1x, cp1y, cp2x, cp2y };
};