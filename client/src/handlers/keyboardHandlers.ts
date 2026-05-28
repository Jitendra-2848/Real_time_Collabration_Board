import { KEY_TO_TOOL } from "../constants/tools";
import type { Element } from "../lib/types";

export interface KeyboardAction {
  action: string;
  data?: any;
}

export const handleKeyDown = (
  e: KeyboardEvent,
  elements: Element[],
  historyIndex: number,
  presentationMode: boolean
): KeyboardAction | null => {
  // Don't process if typing in an input
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  ) {
    return null;
  }

  const ctrl = e.ctrlKey || e.metaKey;

  if (presentationMode) {
    switch (e.key) {
      case "ArrowRight":
      case " ":
        return { action: "presentation-next" };
      case "ArrowLeft":
        return { action: "presentation-prev" };
      case "Escape":
        return { action: "exit-presentation" };
    }
    return null;
  }

  // Undo
  if (ctrl && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    return { action: "undo" };
  }

  // Redo
  if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
    e.preventDefault();
    return { action: "redo" };
  }

  // Delete
  if (e.key === "Delete" || e.key === "Backspace") {
    return { action: "delete-selected" };
  }

  // Copy
  if (ctrl && e.key === "c") {
    e.preventDefault();
    return { action: "copy" };
  }

  // Cut
  if (ctrl && e.key === "x") {
    e.preventDefault();
    return { action: "cut" };
  }

  // Paste
  if (ctrl && e.key === "v") {
    e.preventDefault();
    return { action: "paste" };
  }

  // Duplicate
  if (ctrl && e.key === "d") {
    e.preventDefault();
    return { action: "duplicate" };
  }

  // Select all
  if (ctrl && e.key === "a") {
    e.preventDefault();
    return { action: "select-all" };
  }

  // Group
  if (ctrl && e.key === "g" && !e.shiftKey) {
    e.preventDefault();
    return { action: "group" };
  }

  // Ungroup
  if (ctrl && e.key === "g" && e.shiftKey) {
    e.preventDefault();
    return { action: "ungroup" };
  }

  // Reset zoom
  if (ctrl && e.key === "0") {
    e.preventDefault();
    return { action: "reset-zoom" };
  }

  // Bring to front
  if (ctrl && e.key === "]" && e.shiftKey) {
    e.preventDefault();
    return { action: "bring-to-front" };
  }

  // Send to back
  if (ctrl && e.key === "[" && e.shiftKey) {
    e.preventDefault();
    return { action: "send-to-back" };
  }

  // Bring forward
  if (ctrl && e.key === "]") {
    e.preventDefault();
    return { action: "bring-forward" };
  }

  // Send backward
  if (ctrl && e.key === "[") {
    e.preventDefault();
    return { action: "send-backward" };
  }

  // Alignment
  if (ctrl && e.key === "ArrowLeft") {
    e.preventDefault();
    return { action: "align-left" };
  }

  if (ctrl && e.key === "ArrowRight") {
    e.preventDefault();
    return { action: "align-right" };
  }

  if (ctrl && e.key === "ArrowUp") {
    e.preventDefault();
    return { action: "align-top" };
  }

  if (ctrl && e.key === "ArrowDown") {
    e.preventDefault();
    return { action: "align-bottom" };
  }

  // Export
  if (ctrl && e.key === "e") {
    e.preventDefault();
    return { action: "export-png" };
  }

  // Tool selection by key
  const tool = KEY_TO_TOOL[e.key.toLowerCase()];
  if (tool) {
    return { action: "select-tool", data: tool };
  }

  return null;
};
