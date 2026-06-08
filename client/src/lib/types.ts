export type Tool = 
  | "select" 
  | "hand" 
  | "pen" 
  | "rect" 
  | "circle" 
  | "diamond" 
  | "cylinder"
  | "arrow" 
  | "line"
  | "text" 
  | "eraser"
  | "icon"
  | "eyedropper"
  | "sticky"
  | "highlighter"
  | "comment";

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

export type FontDrawStyle = "rough" | "clean" | "mono";

// =========================================================
// TEXT SYSTEM TYPES
// =========================================================

export type TextType = "canvas" | "node" | "edge";

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  lineHeight: number;
}

export interface TextElement {
  id: string;
  type: TextType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  style: TextStyle;
  textStyle: FontDrawStyle;
  opacity: number;
  rotation: number;
  isSelected: boolean;
  locked: boolean;
  // For node text
  parentId?: string;
  // For edge text
  edgeId?: string;
  edgeOffset?: number; // 0-1 along the edge path
  edgeDragOffset?: { x: number; y: number }; // Manual drag offset from midpoint
  connectedElementIds?: string[];
}

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
  labelStyle?: FontDrawStyle;
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
  textStyle?: FontDrawStyle;
  icon?: string;
  iconName?: string;
  iconColor?: string;
  svgPaths?: string[];
  viewBox?: string;
  styleMode?: "shadow" | "plain" | "watercolor";
  isSelected?: boolean;
  boundElementIds?: { start?: string | null; end?: string | null };
  groupId?: string;
  locked?: boolean;
  lineStyle?: "solid" | "dashed" | "dotted";
  arrowStyle?: "default" | "filled" | "none";
  label?: { text: string; offsetX?: number; offsetY?: number; style?: FontDrawStyle };
  imageData?: string;
  rotation?: number;
  resizable?: boolean;
  reshapable?: boolean;
  anchors?: Anchor[];
  connectedElementIds?: string[];
  parentId?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  bold?: boolean;
  italic?: boolean;
  padding?: number;
  lastModified?: number;
  author?: string;
  timestamp?: number;
  resolved?: boolean;
}

export interface BoardSettings {
  defaultTextStyle: FontDrawStyle;
  zoom: number;
  pan: Point;
  gridEnabled: boolean;
  snapEnabled: boolean;
  theme: "light" | "dark";
}

export interface AppState {
  elements: Element[];
  connectors: Connector[];
  textElements: TextElement[];
  pan: Point;
  zoom: number;
  selectedTool: Tool;
  config: DrawConfig;
  defaultTextStyle: FontDrawStyle;
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