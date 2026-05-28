import { useState } from "react";
import { PRESET_COLORS, DEFAULT_STROKE_COLOR, DEFAULT_FILL_COLOR } from "../constants/colors";

export const useDrawingStyle = () => {
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState(DEFAULT_FILL_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(100);
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [arrowStyle, setArrowStyle] = useState<"default" | "filled" | "none">("default");
  const [eraserSize, setEraserSize] = useState(10);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const updateStrokeColor = (color: string) => {
    setStrokeColor(color);
    setRecentColors(prev => [...new Set([color, ...prev])].slice(0, 5));
  };

  return {
    strokeColor,
    setStrokeColor: updateStrokeColor,
    fillColor,
    setFillColor,
    strokeWidth,
    setStrokeWidth,
    opacity,
    setOpacity,
    lineStyle,
    setLineStyle,
    arrowStyle,
    setArrowStyle,
    eraserSize,
    setEraserSize,
    recentColors,
    presetColors: PRESET_COLORS
  };
};
