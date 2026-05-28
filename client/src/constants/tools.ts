export type Tool = "select" | "hand" | "pen" | "rect" | "circle" | "line" | "arrow" | "text" | "eraser" | "icon" | "sticky" | "highlighter" | "eyedropper";
export type Action = "none" | "drawing" | "moving" | "panning" | "erasing" | "resizing" | "connecting" | "commenting";
export type LineStyle = "solid" | "dashed" | "dotted";
export type ArrowStyle = "default" | "filled" | "none";

export const KEY_TO_TOOL: Record<string, Tool> = {
  v: "select",
  h: "hand",
  p: "pen",
  r: "rect",
  c: "circle",
  l: "line",
  a: "arrow",
  t: "text",
  e: "eraser",
  i: "icon",
};

export const RESIZE_HANDLE_SIZE = 8;
export const EDGE_THRESHOLD = 10;
