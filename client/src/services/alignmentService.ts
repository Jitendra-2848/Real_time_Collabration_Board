import type { Element } from "../lib/types";
import { getElementBounds } from "../lib/utils";

type AlignDirection = "left" | "center" | "right" | "top" | "middle" | "bottom" | "distribute-h" | "distribute-v";

export const alignSelected = (elements: Element[], direction: AlignDirection): Element[] => {
  const selected = elements.filter(el => el.isSelected);
  if (selected.length < 2) return elements;

  return elements.map(el => {
    if (!el.isSelected) return el;

    const b = getElementBounds(el);
    const allBounds = selected.map(s => getElementBounds(s));
    const minX = Math.min(...allBounds.map(b => b.x));
    const maxX = Math.max(...allBounds.map(b => b.x + b.width));
    const minY = Math.min(...allBounds.map(b => b.y));
    const maxY = Math.max(...allBounds.map(b => b.y + b.height));
    
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let dx = 0;
    let dy = 0;

    switch (direction) {
      case "left":
        dx = minX - b.x;
        break;
      case "center":
        dx = cx - (b.x + b.width / 2);
        break;
      case "right":
        dx = maxX - (b.x + b.width);
        break;
      case "top":
        dy = minY - b.y;
        break;
      case "middle":
        dy = cy - (b.y + b.height / 2);
        break;
      case "bottom":
        dy = maxY - (b.y + b.height);
        break;
      case "distribute-h": {
        const sorted = [...selected].sort((a, b) => getElementBounds(a).x - getElementBounds(b).x);
        const idx = sorted.findIndex(s => s.id === el.id);
        if (idx > 0 && idx < sorted.length - 1) {
          const sp = (maxX - minX) / (sorted.length - 1);
          dx = (minX + sp * idx) - b.x;
        }
        break;
      }
      case "distribute-v": {
        const sorted = [...selected].sort((a, b) => getElementBounds(a).y - getElementBounds(b).y);
        const idx = sorted.findIndex(s => s.id === el.id);
        if (idx > 0 && idx < sorted.length - 1) {
          const sp = (maxY - minY) / (sorted.length - 1);
          dy = (minY + sp * idx) - b.y;
        }
        break;
      }
    }

    return { ...el, x: el.x + dx, y: el.y + dy };
  });
};

export const bringToFront = (elements: Element[]): Element[] => {
  const selected = elements.filter(el => el.isSelected);
  if (selected.length === 0) return elements;
  const others = elements.filter(el => !el.isSelected);
  return [...others, ...selected];
};

export const sendToBack = (elements: Element[]): Element[] => {
  const selected = elements.filter(el => el.isSelected);
  if (selected.length === 0) return elements;
  const others = elements.filter(el => !el.isSelected);
  return [...selected, ...others];
};

export const bringForward = (elements: Element[]): Element[] => {
  const idx = elements.findIndex(el => el.isSelected);
  if (idx < 0 || idx >= elements.length - 1) return elements;
  const arr = [...elements];
  [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
  return arr;
};

export const sendBackward = (elements: Element[]): Element[] => {
  const idx = elements.findIndex(el => el.isSelected);
  if (idx <= 0) return elements;
  const arr = [...elements];
  [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
  return arr;
};
