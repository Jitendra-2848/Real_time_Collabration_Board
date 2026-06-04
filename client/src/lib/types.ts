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

export type TextStyle = "rough" | "clean" | "mono";

export interface Anchor {
  id: string;
  elementId: string;
  x: number;
  y: number;
  position: "top" | "bottom" | "left" | "right" | "center";
}

export interface Connector {
  id: string;
  sourceId: string;
  targetId: string;
  sourceAnchor?: string;
  targetAnchor?: string;
  label?: string;
  labelStyle?: TextStyle;
  arrowStyle?: "default" | "filled" | "none";
  lineStyle?: "solid" | "dashed" | "dotted";
  color?: string;
  strokeWidth?: number;
  isSelected?: boolean;
  lastModified?: number;
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
  textStyle?: TextStyle;
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
  label?: { text: string; offsetX?: number; offsetY?: number; style?: TextStyle };
  imageData?: string;
  rotation?: number;
  resizable?: boolean;
  reshapable?: boolean;
  anchors?: Anchor[];
  connectedElementIds?: string[];
  parentId?: string;
  lastModified?: number;
}

export interface BoardSettings {
  defaultTextStyle: TextStyle;
  zoom: number;
  pan: Point;
  gridEnabled: boolean;
  snapEnabled: boolean;
  theme: "light" | "dark";
}

export interface AppState {
  elements: Element[];
  connectors: Connector[];
  pan: Point;
  zoom: number;
  selectedTool: Tool;
  config: DrawConfig;
  defaultTextStyle: TextStyle;
}

export interface DrawConfig {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
}

export type ReshapeHandle =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right"
  | "start-point" | "end-point"
  | "curve-control";