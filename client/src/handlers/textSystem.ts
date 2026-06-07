import { v4 as uuid } from "uuid";
import type { TextElement, Point, FontDrawStyle, Element, Connector } from "../lib/types";

// =========================================================
// TEXT ELEMENT FACTORIES
// =========================================================

export const createCanvasText = (
  point: Point,
  color: string,
  opacity: number,
  defaultTextStyle: FontDrawStyle = "rough"
): TextElement => {
  const id = uuid();
  return {
    id,
    type: "canvas",
    x: point.x,
    y: point.y,
    width: 200,
    height: 60,
    text: "",
    style: {
      fontSize: 16,
      fontFamily: "Inter, sans-serif",
      color,
      bold: false,
      italic: false,
      align: "left",
      lineHeight: 1.2,
    },
    textStyle: defaultTextStyle,
    opacity: opacity / 100,
    rotation: 0,
    isSelected: false,
    locked: false,
  };
};

export const createNodeText = (
  parentElement: Element,
  color: string,
  opacity: number,
  defaultTextStyle: FontDrawStyle = "rough"
): TextElement => {
  const id = uuid();
  const bounds = getElementBoundsLocal(parentElement);
  return {
    id,
    type: "node",
    parentId: parentElement.id,
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
    width: bounds.width - 16,
    height: bounds.height - 16,
    text: "",
    style: {
      fontSize: 14,
      fontFamily: "Inter, sans-serif",
      color,
      bold: false,
      italic: false,
      align: "center",
      lineHeight: 1.25,
    },
    textStyle: defaultTextStyle,
    opacity: opacity / 100,
    rotation: 0,
    isSelected: false,
    locked: false,
  };
};

export const createEdgeText = (
  connector: Connector,
  elements: Element[],
  color: string,
  opacity: number,
  defaultTextStyle: FontDrawStyle = "rough"
): TextElement => {
  const id = uuid();
  const midpoint = getConnectorMidpoint(connector, elements);
  if (!midpoint) {
    throw new Error("Cannot create edge text: connector endpoints not found");
  }
  return {
    id,
    type: "edge",
    edgeId: connector.id,
    x: midpoint.x,
    y: midpoint.y,
    width: 100,
    height: 24,
    text: "",
    style: {
      fontSize: 12,
      fontFamily: "Inter, sans-serif",
      color,
      bold: false,
      italic: false,
      align: "center",
      lineHeight: 1.2,
    },
    textStyle: defaultTextStyle,
    opacity: opacity / 100,
    rotation: 0,
    isSelected: false,
    locked: false,
    edgeOffset: 0.5,
    edgeDragOffset: { x: 0, y: 0 },
  };
};

// =========================================================
// UTILITY FUNCTIONS
// =========================================================

export const getElementBoundsLocal = (el: Element) => {
  if (el.tool === "pen" && el.points && el.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    el.points.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return {
    x: el.width < 0 ? el.x + el.width : el.x,
    y: el.height < 0 ? el.y + el.height : el.y,
    width: Math.abs(el.width),
    height: Math.abs(el.height),
  };
};

export const applyTextStyleToContext = (
  ctx: CanvasRenderingContext2D,
  fontSize: number,
  style: FontDrawStyle | undefined,
  defaultStyle: FontDrawStyle = "rough",
  bold?: boolean,
  italic?: boolean,
  customFontFamily?: string
): void => {
  const resolved = style || defaultStyle;
  ctx.shadowColor = "transparent"; 
  ctx.shadowBlur = 0;
  
  let fontFamily = "";
  if (customFontFamily) {
    fontFamily = customFontFamily;
  } else if (resolved === "mono") {
    fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Courier New', monospace";
  } else if (resolved === "clean") {
    fontFamily = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";
  } else {
    fontFamily = "'Caveat', 'Comic Sans MS', 'Comic Sans', cursive, sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.04)";
    ctx.shadowBlur = 1;
  }

  const fontParts: string[] = [];
  if (bold) fontParts.push("bold");
  if (italic) fontParts.push("italic");
  fontParts.push(`${fontSize}px`);
  fontParts.push(fontFamily);

  ctx.font = fontParts.join(" ");
};


// =========================================================
// TEXT RENDERING
// =========================================================

export interface WrappedLine {
  text: string;
  start: number;
  end: number;
}

export const wrapTextWithRanges = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startOffset: number
): WrappedLine[] => {
  const tStart = performance.now();
  if (!text) {
    return [{ text: "", start: startOffset, end: startOffset }];
  }
  const maxW = Math.max(20, maxWidth);
  const words = text.split(' ');
  const wrapped: WrappedLine[] = [];
  
  let currentLineText = "";
  let currentLineStart = startOffset;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLineText = currentLineText ? `${currentLineText} ${word}` : word;
    
    if (ctx.measureText(testLineText).width <= maxW) {
      currentLineText = testLineText;
    } else {
      if (currentLineText) {
        wrapped.push({
          text: currentLineText,
          start: currentLineStart,
          end: currentLineStart + currentLineText.length
        });
        currentLineStart = currentLineStart + currentLineText.length + 1;
      }
      currentLineText = word;
    }
  }
  
  if (currentLineText) {
    wrapped.push({
      text: currentLineText,
      start: currentLineStart,
      end: currentLineStart + currentLineText.length
    });
  }
  
  const tTime = performance.now() - tStart;
  if ((window as any).performanceMetrics) {
    (window as any).performanceMetrics.textLayoutTime = ((window as any).performanceMetrics.textLayoutTime || 0) * 0.9 + tTime * 0.1;
  }
  
  return wrapped;
};

export const getCaretCoordinates = (
  ctx: CanvasRenderingContext2D,
  lines: WrappedLine[],
  caretIndex: number,
  _fontSize: number,
  lineHeight: number,
  startY: number,
  startX: number,
  textAlign: "left" | "center" | "right" | "justify",
  _padding: number,
  _width: number
): { x: number; y: number } => {
  let activeLineIdx = 0;
  let activeLine = lines[0] || { text: "", start: 0, end: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (caretIndex >= line.start && caretIndex <= line.end) {
      activeLineIdx = i;
      activeLine = line;
      break;
    }
  }
  if (caretIndex > lines[lines.length - 1]?.end) {
    activeLineIdx = lines.length - 1;
    activeLine = lines[lines.length - 1];
  }

  const relativeCaretPos = Math.max(0, caretIndex - activeLine.start);
  const textBeforeCaret = activeLine.text.substring(0, relativeCaretPos);
  const textWidthBeforeCaret = ctx.measureText(textBeforeCaret).width;

  let caretX = startX;
  if (textAlign === "center") {
    const lineTotalWidth = ctx.measureText(activeLine.text).width;
    caretX = startX - lineTotalWidth / 2 + textWidthBeforeCaret;
  } else if (textAlign === "right") {
    const lineTotalWidth = ctx.measureText(activeLine.text).width;
    caretX = startX - lineTotalWidth + textWidthBeforeCaret;
  } else {
    caretX = startX + textWidthBeforeCaret;
  }

  const caretY = startY + activeLineIdx * lineHeight;

  return { x: caretX, y: caretY };
};

export const renderTextElement = (
  ctx: CanvasRenderingContext2D,
  textEl: TextElement,
  zoom: number = 1,
  defaultTextStyle: FontDrawStyle = "rough",
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number
) => {
  ctx.save();
  ctx.globalAlpha = textEl.opacity ?? 1;
  ctx.translate(textEl.x, textEl.y);
  if (textEl.rotation) {
    ctx.rotate(textEl.rotation * Math.PI / 180);
  }

  const fontSize = textEl.style.fontSize;
  const color = textEl.style.color;
  const align = textEl.style.align;
  const bold = textEl.style.bold;
  const italic = textEl.style.italic;
  const fontFamily = textEl.style.fontFamily;
  const userLineHeight = textEl.style.lineHeight || 1.2;

  applyTextStyleToContext(ctx, fontSize, textEl.textStyle, defaultTextStyle, bold, italic, fontFamily);
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;

  const textVal = editingText !== undefined ? editingText : (textEl.text || "");

  const padding = 8;
  const paragraphs = textVal.split("\n");
  let currentOffset = 0;
  const lines: WrappedLine[] = [];
  paragraphs.forEach(p => {
    const wrapped = wrapTextWithRanges(ctx, p, textEl.width - padding * 2, currentOffset);
    lines.push(...wrapped);
    currentOffset += p.length + 1;
  });

  const lineHeight = fontSize * userLineHeight;
  const totalTextHeight = lines.length * lineHeight;
  const startY = (textEl.height - totalTextHeight) / 2 + lineHeight / 2;

  let startX = padding;
  if (align === "center") startX = textEl.width / 2;
  else if (align === "right") startX = textEl.width - padding;

  lines.forEach((line, i) => {
    ctx.fillText(line.text, startX, startY + i * lineHeight);
  });

  // Render blinking caret/cursor
  if (editingText !== undefined && caretVisible) {
    const coords = getCaretCoordinates(
      ctx,
      lines,
      caretIndex || 0,
      fontSize,
      lineHeight,
      startY,
      startX,
      align,
      padding,
      textEl.width
    );

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.moveTo(coords.x + 1, coords.y - fontSize / 2);
    ctx.lineTo(coords.x + 1, coords.y + fontSize / 2);
    ctx.stroke();
  }

  // Selection box
  if (textEl.isSelected && editingText === undefined) {
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(-4/zoom, -4/zoom, textEl.width + 8/zoom, textEl.height + 8/zoom);
    ctx.setLineDash([]);
    
    // Resize handles
    const handles = [
      { x: 0, y: 0 }, { x: textEl.width/2, y: 0 }, { x: textEl.width, y: 0 },
      { x: 0, y: textEl.height/2 }, { x: textEl.width, y: textEl.height/2 },
      { x: 0, y: textEl.height }, { x: textEl.width/2, y: textEl.height }, { x: textEl.width, y: textEl.height },
    ];
    const size = 8 / zoom;
    const half = size / 2;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5 / zoom;
    handles.forEach(h => {
      ctx.fillRect(h.x - half, h.y - half, size, size);
      ctx.strokeRect(h.x - half, h.y - half, size, size);
    });
  }

  ctx.restore();
};

// =========================================================
// TEXT EDITING HELPERS
// =========================================================

export const handleTextBlur = (
  editingElementId: string,
  editingText: string,
  textElements: TextElement[]
): TextElement[] => {
  const trimmedText = editingText.trim();
  return textElements
    .map(el => {
      if (el.id !== editingElementId) return el;
      if (!trimmedText && el.type === "canvas") {
        return null; // Delete empty canvas text
      }
      return { ...el, text: editingText };
    })
    .filter((el): el is TextElement => el !== null);
};

export const updateNodeTextPosition = (
  textEl: TextElement,
  parentElement: Element
): TextElement => {
  const bounds = getElementBoundsLocal(parentElement);
  return {
    ...textEl,
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
    width: Math.max(bounds.width - 16, 40),
    height: Math.max(bounds.height - 16, 30),
  };
};

export const updateEdgeTextPosition = (
  textEl: TextElement,
  connector: Connector,
  elements: Element[]
): TextElement => {
  const midpoint = getConnectorMidpoint(connector, elements);
  if (!midpoint) return textEl;

  // Apply stored offset from drag
  const dragOffset = textEl.edgeDragOffset || { x: 0, y: 0 };
  
  return {
    ...textEl,
    x: midpoint.x + dragOffset.x,
    y: midpoint.y + dragOffset.y,
  };
};

// Get midpoint of connector using bezier curve
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

  // For straight lines, use simple midpoint
  // For curved connectors, we'd need the control points
  return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
};

// Check if point is inside text element
export const isPointInTextElement = (
  px: number,
  py: number,
  textEl: TextElement
): boolean => {
  // Transform point to text element's local coordinates (accounting for rotation)
  const cos = Math.cos(-textEl.rotation * Math.PI / 180);
  const sin = Math.sin(-textEl.rotation * Math.PI / 180);
  const dx = px - textEl.x;
  const dy = py - textEl.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return localX >= 0 && localX <= textEl.width && localY >= 0 && localY <= textEl.height;
};

// Get resize handle for text element
export const getTextResizeHandle = (
  px: number,
  py: number,
  textEl: TextElement,
  zoom: number,
  handleSize: number = 8
): string | null => {
  // Transform point to local coordinates
  const cos = Math.cos(-textEl.rotation * Math.PI / 180);
  const sin = Math.sin(-textEl.rotation * Math.PI / 180);
  const dx = px - textEl.x;
  const dy = py - textEl.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  const threshold = handleSize / zoom;
  const handles = [
    { name: "top-left", x: 0, y: 0 },
    { name: "top-center", x: textEl.width/2, y: 0 },
    { name: "top-right", x: textEl.width, y: 0 },
    { name: "middle-left", x: 0, y: textEl.height/2 },
    { name: "middle-right", x: textEl.width, y: textEl.height/2 },
    { name: "bottom-left", x: 0, y: textEl.height },
    { name: "bottom-center", x: textEl.width/2, y: textEl.height },
    { name: "bottom-right", x: textEl.width, y: textEl.height },
  ];

  for (const h of handles) {
    if (Math.abs(localX - h.x) < threshold && Math.abs(localY - h.y) < threshold) {
      return h.name;
    }
  }
  return null;
};

// Resize text element
export const resizeTextElement = (
  textEl: TextElement,
  handle: string,
  deltaX: number,
  deltaY: number
): TextElement => {
  const updated = { ...textEl };
  
  // Transform deltas to local coordinates
  const cos = Math.cos(-textEl.rotation * Math.PI / 180);
  const sin = Math.sin(-textEl.rotation * Math.PI / 180);
  const localDeltaX = deltaX * cos - deltaY * sin;
  const localDeltaY = deltaX * sin + deltaY * cos;

  switch (handle) {
    case "top-left":
      updated.x += deltaX; updated.y += deltaY;
      updated.width -= localDeltaX; updated.height -= localDeltaY;
      break;
    case "top-center":
      updated.y += deltaY; updated.height -= localDeltaY;
      break;
    case "top-right":
      updated.y += deltaY; updated.width += localDeltaX; updated.height -= localDeltaY;
      break;
    case "middle-left":
      updated.x += deltaX; updated.width -= localDeltaX;
      break;
    case "middle-right":
      updated.width += localDeltaX;
      break;
    case "bottom-left":
      updated.x += deltaX; updated.width -= localDeltaX; updated.height += localDeltaY;
      break;
    case "bottom-center":
      updated.height += localDeltaY;
      break;
    case "bottom-right":
      updated.width += localDeltaX; updated.height += localDeltaY;
      break;
  }

  // Minimum size constraints
  updated.width = Math.max(updated.width, 40);
  updated.height = Math.max(updated.height, 30);

  return updated;
};