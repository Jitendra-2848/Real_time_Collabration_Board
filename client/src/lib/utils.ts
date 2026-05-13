import type { Element, Point } from "./types";

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

export const getBoundingBox = (el: Element) => {
  if (el.tool === "pen" && el.points && el.points.length > 0) {
    const xs = el.points.map((p) => p.x);
    const ys = el.points.map((p) => p.y);

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  if (el.tool === "arrow" || el.tool === "line") {
    const x1 = el.x;
    const y1 = el.y;
    const x2 = el.x + el.width;
    const y2 = el.y + el.height;

    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  return {
    x: Math.min(el.x, el.x + el.width),
    y: Math.min(el.y, el.y + el.height),
    width: Math.abs(el.width),
    height: Math.abs(el.height),
  };
};

export const normalizeElement = (el: Element): Element => {
  if (
    el.tool === "rect" ||
    el.tool === "circle" ||
    el.tool === "diamond" ||
    el.tool === "icon"
  ) {
    return {
      ...el,
      x: Math.min(el.x, el.x + el.width),
      y: Math.min(el.y, el.y + el.height),
      width: Math.abs(el.width),
      height: Math.abs(el.height),
    };
  }

  return el;
};

export const isPointInElement = (x: number, y: number, el: Element): boolean => {
  if (el.tool === "pen" && el.points) {
    return el.points.some((p) => Math.hypot(p.x - x, p.y - y) < 14);
  }

  if (el.tool === "circle") {
    const box = getBoundingBox(el);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const rx = Math.max(box.width / 2, 1);
    const ry = Math.max(box.height / 2, 1);

    const dx = x - cx;
    const dy = y - cy;

    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  }

  if (el.tool === "diamond") {
    const box = getBoundingBox(el);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const hw = Math.max(box.width / 2, 1);
    const hh = Math.max(box.height / 2, 1);

    return Math.abs(x - cx) / hw + Math.abs(y - cy) / hh <= 1;
  }

  if (el.tool === "line" || el.tool === "arrow") {
    const dist = distanceToSegment(
      x,
      y,
      el.x,
      el.y,
      el.x + el.width,
      el.y + el.height
    );

    return dist < 12;
  }

  if (el.tool === "text") {
    const box = getBoundingBox(el);
    const w = Math.max(box.width, 120);
    const h = Math.max(box.height, 30);

    return x >= el.x && x <= el.x + w && y >= el.y && y <= el.y + h;
  }

  const box = getBoundingBox(el);

  return (
    x >= box.x &&
    x <= box.x + box.width &&
    y >= box.y &&
    y <= box.y + box.height
  );
};

export const distanceToSegment = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx;
  let yy;

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

  return Math.hypot(px - xx, py - yy);
};

export const getResizeHandles = (el: Element, zoom = 1) => {
  const size = 10 / zoom;

  if (el.tool === "arrow" || el.tool === "line") {
    const start = {
      x: el.x - size / 2,
      y: el.y - size / 2,
      width: size,
      height: size,
    };

    const end = {
      x: el.x + el.width - size / 2,
      y: el.y + el.height - size / 2,
      width: size,
      height: size,
    };

    const middle = {
      x: el.x + el.width / 2 - size / 2,
      y: el.y + el.height / 2 - size / 2,
      width: size,
      height: size,
    };

    return { start, middle, end };
  }

  const box = getBoundingBox(el);

  return {
    nw: {
      x: box.x - size / 2,
      y: box.y - size / 2,
      width: size,
      height: size,
    },
    n: {
      x: box.x + box.width / 2 - size / 2,
      y: box.y - size / 2,
      width: size,
      height: size,
    },
    ne: {
      x: box.x + box.width - size / 2,
      y: box.y - size / 2,
      width: size,
      height: size,
    },
    e: {
      x: box.x + box.width - size / 2,
      y: box.y + box.height / 2 - size / 2,
      width: size,
      height: size,
    },
    se: {
      x: box.x + box.width - size / 2,
      y: box.y + box.height - size / 2,
      width: size,
      height: size,
    },
    s: {
      x: box.x + box.width / 2 - size / 2,
      y: box.y + box.height - size / 2,
      width: size,
      height: size,
    },
    sw: {
      x: box.x - size / 2,
      y: box.y + box.height - size / 2,
      width: size,
      height: size,
    },
    w: {
      x: box.x - size / 2,
      y: box.y + box.height / 2 - size / 2,
      width: size,
      height: size,
    },
  };
};

export const isPointInHandle = (
  x: number,
  y: number,
  handle: { x: number; y: number; width: number; height: number }
) => {
  return (
    x >= handle.x &&
    x <= handle.x + handle.width &&
    y >= handle.y &&
    y <= handle.y + handle.height
  );
};