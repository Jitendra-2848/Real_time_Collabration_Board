export type Tool = 
  | "select" 
  | "hand" 
  | "pen" 
  | "rect" 
  | "circle" 
  | "diamond" 
  | "arrow" 
  | "line"
  | "text" 
  | "eraser"
  | "icon"
  | "eyedropper"
  | "sticky"
  | "highlighter";

export interface Point {
  x: number;
  y: number;
}

export interface Guide {
  id: string;
  type: "horizontal" | "vertical";
  position: number;
}

export interface Comment {
  id: string;
  x: number;
  y: number;
  text: string;
  author: string;
  timestamp: number;
  resolved: boolean;
}

export interface Element {
  id: string;
  tool: Tool;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Point[]; 
  color: string;
  fillColor?: string;
  strokeWidth: number;
  opacity?: number;
  text?: string;
  icon?: string;
  iconName?: string;
  iconColor?: string;
  svgPaths?: string[];
  viewBox?: string;
  isSelected?: boolean;
  boundElementIds?: { start?: string | null; end?: string | null };
  groupId?: string;
  locked?: boolean;
  lineStyle?: "solid" | "dashed" | "dotted";
  arrowStyle?: "default" | "filled" | "none";
  label?: { text: string; offsetX?: number; offsetY?: number };
  imageData?: string; // base64 for imported images
  rotation?: number;
  lastModified?: number;
}

export interface AppState {
  elements: Element[];
  pan: Point;
  zoom: number;
  selectedTool: Tool;
  config: DrawConfig;
}

export interface DrawConfig {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
}