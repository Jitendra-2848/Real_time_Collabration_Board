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
  | "soft-eraser"
  | "icon";

export interface Point {
  x: number;
  y: number;
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

  text?: string;

  iconName?: string;
  iconColor?: string;
  iconPath?: string;

  isSelected?: boolean;
  opacity?: number;

  /**
   * For curved arrows.
   * 0 means straight arrow.
   */
  curveOffset?: number;
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