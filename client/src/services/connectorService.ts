import { v4 as uuid } from "uuid";
import type { Element, Connector, Point, TextStyle, Anchor } from "../lib/types";
import { getElementBounds } from "../lib/utils";

// Find the closest anchor point on an element to a given point
export const findClosestAnchor = (
  el: Element,
  px: number,
  py: number
): { anchor: Anchor; distance: number } | null => {
  const bounds = getElementBounds(el);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;

  const candidates: { position: Anchor["position"]; x: number; y: number }[] = [
    { position: "top", x: cx, y: bounds.y },
    { position: "bottom", x: cx, y: bounds.y + bounds.height },
    { position: "left", x: bounds.x, y: cy },
    { position: "right", x: bounds.x + bounds.width, y: cy },
    { position: "center", x: cx, y: cy },
  ];

  // Also check existing anchors
  if (el.anchors) {
    for (const a of el.anchors) {
      candidates.push({ position: a.position, x: a.x, y: a.y });
    }
  }

  let best: { position: Anchor["position"]; x: number; y: number } | null = null;
  let bestDist = Infinity;

  for (const c of candidates) {
    // Add directional scoring bias – prefer anchors "facing" the connection point
    const dx = px - c.x;
    const dy = py - c.y;
    const dist = Math.hypot(dx, dy);
    
    let bias = 0;
    // Prefer anchors that are in the direction of the connecting point
    if (c.position === "top" && dy < 0) bias = -dist * 0.2;
    else if (c.position === "bottom" && dy > 0) bias = -dist * 0.2;
    else if (c.position === "left" && dx < 0) bias = -dist * 0.2;
    else if (c.position === "right" && dx > 0) bias = -dist * 0.2;
    else if (c.position === "center") bias = dist * 0.3;

    const score = dist + bias;
    if (score < bestDist) {
      bestDist = score;
      best = c;
    }
  }

  if (!best) return null;

  return {
    anchor: {
      id: `${el.id}-${best.position}`,
      elementId: el.id,
      x: best.x,
      y: best.y,
      position: best.position,
    },
    distance: bestDist,
  };
};

// Automatically create a connector between two elements
export const createAutoConnector = (
  sourceEl: Element,
  targetEl: Element,
  existingConnectors: Connector[],
  options?: {
    label?: string;
    labelStyle?: TextStyle;
    arrowStyle?: "default" | "filled" | "none";
    lineStyle?: "solid" | "dashed" | "dotted";
    color?: string;
    strokeWidth?: number;
  }
): Connector => {
  const sourceCenter = {
    x: sourceEl.x + sourceEl.width / 2,
    y: sourceEl.y + sourceEl.height / 2,
  };
  const targetCenter = {
    x: targetEl.x + targetEl.width / 2,
    y: targetEl.y + targetEl.height / 2,
  };

  const sourceAnchor = findClosestAnchor(sourceEl, targetCenter.x, targetCenter.y);
  const targetAnchor = findClosestAnchor(targetEl, sourceCenter.x, sourceCenter.y);

  const id = uuid();
  return {
    id,
    sourceId: sourceEl.id,
    targetId: targetEl.id,
    sourceAnchor: sourceAnchor?.anchor.id,
    targetAnchor: targetAnchor?.anchor.id,
    label: options?.label,
    labelStyle: options?.labelStyle,
    arrowStyle: options?.arrowStyle || "default",
    lineStyle: options?.lineStyle || "solid",
    color: options?.color || "#000",
    strokeWidth: options?.strokeWidth || 2,
    isSelected: false,
    lastModified: Date.now(),
  };
};

// Check if a point is near any connector path (for selection)
export const isPointNearConnector = (
  px: number,
  py: number,
  connector: Connector,
  elements: Element[],
  threshold: number = 10
): boolean => {
  const sourceEl = elements.find((el) => el.id === connector.sourceId);
  const targetEl = elements.find((el) => el.id === connector.targetId);
  if (!sourceEl || !targetEl) return false;

  const sBounds = getElementBounds(sourceEl);
  const tBounds = getElementBounds(targetEl);
  const sx = sBounds.x + sBounds.width / 2;
  const sy = sBounds.y + sBounds.height / 2;
  const tx = tBounds.x + tBounds.width / 2;
  const ty = tBounds.y + tBounds.height / 2;

  // Quadratic bezier midpoint curve
  const midX = (sx + tx) / 2 + Math.abs(tx - sx) * 0.1;
  const midY = (sy + ty) / 2 + Math.abs(ty - sy) * 0.1;

  // Sample points along the curve
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const cx = inv * inv * sx + 2 * inv * t * midX + t * t * tx;
    const cy = inv * inv * sy + 2 * inv * t * midY + t * t * ty;
    if (Math.hypot(px - cx, py - cy) < threshold) return true;
  }

  return false;
};

// Get the midpoint of a connector path (for label positioning)
export const getConnectorMidpoint = (
  connector: Connector,
  elements: Element[]
): Point | null => {
  const sourceEl = elements.find((el) => el.id === connector.sourceId);
  const targetEl = elements.find((el) => el.id === connector.targetId);
  if (!sourceEl || !targetEl) return null;

  const sx = sourceEl.x + sourceEl.width / 2;
  const sy = sourceEl.y + sourceEl.height / 2;
  const tx = targetEl.x + targetEl.width / 2;
  const ty = targetEl.y + targetEl.height / 2;

  return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
};

// Update all connector positions based on current element positions
export const refreshAllConnectors = (
  connectors: Connector[],
  elements: Element[]
): Connector[] => {
  return connectors.map((conn) => {
    const sourceEl = elements.find((el) => el.id === conn.sourceId);
    const targetEl = elements.find((el) => el.id === conn.targetId);
    if (!sourceEl || !targetEl) return conn;

    const sourceCenter = {
      x: sourceEl.x + sourceEl.width / 2,
      y: sourceEl.y + sourceEl.height / 2,
    };
    const targetCenter = {
      x: targetEl.x + targetEl.width / 2,
      y: targetEl.y + targetEl.height / 2,
    };

    const sourceAnchor = findClosestAnchor(sourceEl, targetCenter.x, targetCenter.y);
    const targetAnchor = findClosestAnchor(targetEl, sourceCenter.x, sourceCenter.y);

    return {
      ...conn,
      sourceAnchor: sourceAnchor?.anchor.id || conn.sourceAnchor,
      targetAnchor: targetAnchor?.anchor.id || conn.targetAnchor,
      lastModified: Date.now(),
    };
  });
};

// Find element at point (returns topmost)
export const findElementAtPoint = (
  px: number,
  py: number,
  elements: Element[]
): Element | null => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const bounds = getElementBounds(el);
    if (
      px >= bounds.x &&
      px <= bounds.x + bounds.width &&
      py >= bounds.y &&
      py <= bounds.y + bounds.height
    ) {
      return el;
    }
  }
  return null;
};

// Generate anchors for an element based on its shape type
export const generateAnchors = (el: Element): Anchor[] => {
  const bounds = getElementBounds(el);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  return [
    { id: `${el.id}-top`, elementId: el.id, x: cx, y: bounds.y, position: "top" },
    { id: `${el.id}-bottom`, elementId: el.id, x: cx, y: bounds.y + bounds.height, position: "bottom" },
    { id: `${el.id}-left`, elementId: el.id, x: bounds.x, y: cy, position: "left" },
    { id: `${el.id}-right`, elementId: el.id, x: bounds.x + bounds.width, y: cy, position: "right" },
    { id: `${el.id}-center`, elementId: el.id, x: cx, y: cy, position: "center" },
  ];
};