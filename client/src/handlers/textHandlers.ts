import type { Element, Point } from "../lib/types";
import { v4 as uuid } from "uuid";

export interface TextEditingState {
  elementId: string | null;
  text: string;
  position: Point;
}

export const createTextElement = (
  point: Point,
  strokeColor: string,
  opacity: number
): Element => {
  const id = uuid();
  return {
    id,
    tool: "text",
    x: point.x,
    y: point.y,
    width: 140,
    height: 30,
    color: strokeColor,
    strokeWidth: 1,
    fillColor: "transparent",
    opacity: opacity / 100,
    text: ""
  };
};

export const createStickyNote = (
  point: Point,
  opacity: number
): Element => {
  const id = uuid();
  return {
    id,
    tool: "rect",
    x: point.x,
    y: point.y,
    width: 120,
    height: 100,
    color: "#000",
    fillColor: "#FFD700",
    strokeWidth: 1,
    opacity: opacity / 100,
    text: "Sticky note",
    rotation: Math.random() * 4 - 2
  };
};

export const handleTextBlur = (
  editingElementId: string,
  editingText: string,
  elements: Element[]
): Element[] => {
  const trimmedText = editingText.trim();
  return elements
    .map(el => {
      if (el.id !== editingElementId) return el;
      if (!trimmedText) {
        return el.tool === "text" ? null : { ...el, text: "" };
      }
      return {
        ...el,
        text: editingText
      };
    })
    .filter((el): el is Element => el !== null);
};

export const startTextEdit = (
  elementId: string,
  text: string,
  position: Point
): TextEditingState => ({
  elementId,
  text,
  position
});

export const endTextEdit = (): TextEditingState => ({
  elementId: null,
  text: "",
  position: { x: 0, y: 0 }
});
