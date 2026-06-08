import type { Element, Connector, FontDrawStyle, ReshapeHandle, Point, TextElement } from "./types";
import { findBestAnchors, getConnectorControlPoints } from "./utils";
import { renderTextElement, wrapTextWithRanges, getCaretCoordinates } from "../handlers/textSystem";
import type { WrappedLine } from "../handlers/textSystem";

// =========================================================
// 1. GRID DRAWING
// =========================================================

export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number,
  bgTheme: string = "light-grid"
) => {
  const gridSize = 20;
  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  ctx.strokeStyle = bgTheme === "dark-grid" ? "#333355" : "#e0e0e0";
  ctx.lineWidth = 1 / zoom;

  // Dynamically scale the grid step size to prevent lag when zoomed out
  let currentGridSize = gridSize;
  if (zoom < 0.15) {
    currentGridSize = gridSize * 10;
  } else if (zoom < 0.4) {
    currentGridSize = gridSize * 5;
  } else if (zoom < 0.7) {
    currentGridSize = gridSize * 2;
  }

  const startX = Math.floor((-pan.x / zoom) / currentGridSize) * currentGridSize;
  const startY = Math.floor((-pan.y / zoom) / currentGridSize) * currentGridSize;
  const endX = startX + width / zoom + currentGridSize;
  const endY = startY + height / zoom + currentGridSize;

  ctx.beginPath();
  for (let x = startX; x < endX; x += currentGridSize) { 
    ctx.moveTo(x, startY); 
    ctx.lineTo(x, endY); 
  }
  for (let y = startY; y < endY; y += currentGridSize) { 
    ctx.moveTo(startX, y); 
    ctx.lineTo(endX, y); 
  }
  ctx.stroke();
  ctx.restore();
};

// =========================================================
// 2. HELPERS
// =========================================================


const drawSvgElement = (ctx: CanvasRenderingContext2D, d: string) => {
  const path = new Path2D(d); 
  ctx.fill(path); 
  ctx.stroke(path);
};

const applyShapeStyles = (ctx: CanvasRenderingContext2D, el: Element) => {
  ctx.lineWidth = el.strokeWidth;
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.fillColor || "transparent";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (el.lineStyle === "dashed") {
    ctx.setLineDash([8, 4]);
  } else if (el.lineStyle === "dotted") {
    ctx.setLineDash([2, 4]);
  } else {
    ctx.setLineDash([]);
  }
};

export const applyTextStyle = (
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
// 3. ELEMENT RENDERERS
// =========================================================

const drawInternalIconAndText = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  el: Element,
  defaultTextStyle: FontDrawStyle,
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number
) => {
  const text = editingText !== undefined ? editingText : (el.text || "");
  const hasIcon = el.svgPaths && el.svgPaths.length > 0 && el.viewBox;

  ctx.save();
  const fontSize = el.fontSize || 13;
  const userLineHeight = el.lineHeight || 1.25;
  applyTextStyle(ctx, fontSize, el.textStyle, defaultTextStyle, el.bold, el.italic, el.fontFamily);
  ctx.fillStyle = el.color || "#1e293b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (hasIcon && text) {
    const iconSize = 16;
    const gap = 6;
    const textWidth = ctx.measureText(text).width;
    const totalWidth = iconSize + gap + textWidth;

    const startX = x + (w - totalWidth) / 2;
    const centerY = y + h / 2;

    ctx.save();
    ctx.translate(startX, centerY - iconSize / 2);
    const [vbX, vbY, vbW, vbH] = el.viewBox!.split(' ').map(Number);
    const scale = Math.min(iconSize / vbW, iconSize / vbH);
    ctx.translate((iconSize - vbW * scale) / 2, (iconSize - vbH * scale) / 2);
    ctx.scale(scale, scale);
    ctx.translate(-vbX, -vbY);
    ctx.fillStyle = el.iconColor || el.color || "#1e293b";
    ctx.strokeStyle = "transparent";
    el.svgPaths!.forEach((pathStr) => drawSvgElement(ctx, pathStr));
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillText(text, startX + iconSize + gap, centerY);
  } else if (hasIcon) {
    const iconSize = 20;
    ctx.save();
    ctx.translate(x + (w - iconSize) / 2, y + (h - iconSize) / 2);
    const [vbX, vbY, vbW, vbH] = el.viewBox!.split(' ').map(Number);
    const scale = Math.min(iconSize / vbW, iconSize / vbH);
    ctx.translate((iconSize - vbW * scale) / 2, (iconSize - vbH * scale) / 2);
    ctx.scale(scale, scale);
    ctx.translate(-vbX, -vbY);
    ctx.fillStyle = el.iconColor || el.color || "#1e293b";
    ctx.strokeStyle = "transparent";
    el.svgPaths!.forEach((pathStr) => drawSvgElement(ctx, pathStr));
    ctx.restore();
  } else if (text || editingText !== undefined) {
    const paragraphs = text.split("\n");
    let currentOffset = 0;
    const lines: WrappedLine[] = [];
    paragraphs.forEach(p => {
      const wrapped = wrapTextWithRanges(ctx, p, w - 16, currentOffset);
      lines.push(...wrapped);
      currentOffset += p.length + 1;
    });

    const lineHeight = fontSize * userLineHeight;
    const totalTextHeight = lines.length * lineHeight;
    const startY = y + (h - totalTextHeight) / 2 + lineHeight / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line.text, x + w / 2, startY + i * lineHeight);
    });

    if (editingText !== undefined && caretVisible) {
      const coords = getCaretCoordinates(
        ctx,
        lines,
        caretIndex || 0,
        fontSize,
        lineHeight,
        startY,
        x + w / 2,
        "center",
        8,
        w
      );

      ctx.beginPath();
      ctx.strokeStyle = el.color || "#1e293b";
      ctx.lineWidth = 2;
      ctx.moveTo(coords.x + 1, coords.y - fontSize / 2);
      ctx.lineTo(coords.x + 1, coords.y + fontSize / 2);
      ctx.stroke();
    }
  }

  ctx.restore();
};

const drawRect = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  el: Element, 
  defaultTextStyle: FontDrawStyle = "rough",
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number
) => {
  applyShapeStyles(ctx, el);
  
  if (el.rotation) { 
    ctx.save(); 
    ctx.translate(x + w/2, y + h/2); 
    ctx.rotate(el.rotation * Math.PI / 180); 
    ctx.translate(-(x + w/2), -(y + h/2)); 
  }
  
  if (el.fillColor === "#FFD700") { 
    ctx.shadowColor = "rgba(0,0,0,0.2)"; 
    ctx.shadowBlur = 8; 
    ctx.shadowOffsetX = 2; 
    ctx.shadowOffsetY = 2; 
  } else if (el.styleMode === "shadow") {
    ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
  }
  
  if (el.fillColor) ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  
  if (el.imageData && typeof el.imageData === 'string') {
    const img = new Image(); 
    img.src = el.imageData;
    if (img.complete) {
      ctx.drawImage(img, x, y, w, h);
    }
  }
  
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0; 
  ctx.shadowOffsetX = 0; 
  ctx.shadowOffsetY = 0;
  
  if (el.rotation) ctx.restore();
  
  drawInternalIconAndText(ctx, x, y, w, h, el, defaultTextStyle, editingText, caretVisible, caretIndex);
  
  if (el.label?.text) {
    applyTextStyle(ctx, 14, el.label.style, defaultTextStyle);
    ctx.fillStyle = el.color; 
    ctx.textAlign = "center";
    ctx.fillText(
      el.label.text, 
      x + w/2 + (el.label.offsetX || 0), 
      y + (el.label.offsetY || -10)
    );
  }
};

const drawEllipse = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  el: Element, 
  defaultTextStyle: FontDrawStyle = "rough",
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number
) => {
  applyShapeStyles(ctx, el);
  
  if (el.styleMode === "shadow") {
    ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
  }

  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  if (el.fillColor) ctx.fill();
  ctx.stroke();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0; 
  ctx.shadowOffsetX = 0; 
  ctx.shadowOffsetY = 0;
  
  drawInternalIconAndText(ctx, x, y, w, h, el, defaultTextStyle, editingText, caretVisible, caretIndex);
  
  if (el.label?.text) {
    applyTextStyle(ctx, 14, el.label.style, defaultTextStyle);
    ctx.fillStyle = el.color; 
    ctx.textAlign = "center";
    ctx.fillText(
      el.label.text, 
      x + w/2 + (el.label.offsetX || 0), 
      y + (el.label.offsetY || -10)
    );
  }
};

const drawDiamond = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  el: Element, 
  defaultTextStyle: FontDrawStyle = "rough",
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number
) => {
  applyShapeStyles(ctx, el);
  
  if (el.styleMode === "shadow") {
    ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
  }

  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); 
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h); 
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  if (el.fillColor) ctx.fill();
  ctx.stroke();
  
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0; 
  ctx.shadowOffsetX = 0; 
  ctx.shadowOffsetY = 0;

  drawInternalIconAndText(ctx, x, y, w, h, el, defaultTextStyle, editingText, caretVisible, caretIndex);

  if (el.label?.text) {
    applyTextStyle(ctx, 14, el.label.style, defaultTextStyle);
    ctx.fillStyle = el.color; 
    ctx.textAlign = "center";
    ctx.fillText(el.label.text, x + w/2, y + h/2);
  }
};

const drawCylinder = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  el: Element,
  defaultTextStyle: FontDrawStyle = "rough",
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number
) => {
  applyShapeStyles(ctx, el);

  if (el.rotation) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }

  if (el.styleMode === "shadow") {
    ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
  }

  const rx = w / 2;
  const ry = Math.min(15, h / 5);

  if (el.fillColor) {
    ctx.fillStyle = el.fillColor;
    ctx.beginPath();
    ctx.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.rect(x, y + ry, w, h - 2 * ry);
    ctx.ellipse(x + rx, y + h - ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.ellipse(x + rx, y + h - ry, rx, ry, 0, 0, Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y + ry);
  ctx.lineTo(x, y + h - ry);
  ctx.moveTo(x + w, y + ry);
  ctx.lineTo(x + w, y + h - ry);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0; 
  ctx.shadowOffsetX = 0; 
  ctx.shadowOffsetY = 0;

  if (el.rotation) ctx.restore();

  drawInternalIconAndText(ctx, x, y + ry, w, h - 2 * ry, el, defaultTextStyle, editingText, caretVisible, caretIndex);

  if (el.label?.text) {
    applyTextStyle(ctx, 14, el.label.style, defaultTextStyle);
    ctx.fillStyle = el.color;
    ctx.textAlign = "center";
    ctx.fillText(
      el.label.text,
      x + w / 2 + (el.label.offsetX || 0),
      y + (el.label.offsetY || -10)
    );
  }
};

const drawArrow = (
  ctx: CanvasRenderingContext2D, 
  el: Element, 
  defaultTextStyle: FontDrawStyle = "rough"
) => {
  const x1 = el.x;
  const y1 = el.y;
  const x2 = el.x + el.width;
  const y2 = el.y + el.height;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 15;
  
  applyShapeStyles(ctx, el);
  ctx.beginPath(); 
  ctx.moveTo(x1, y1); 
  ctx.lineTo(x2, y2); 
  ctx.stroke();
  
  if (el.arrowStyle !== "none") {
    ctx.beginPath();
    if (el.arrowStyle === "filled") {
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6), 
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6), 
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath(); 
      ctx.fillStyle = el.color; 
      ctx.fill();
    } else {
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6), 
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6), 
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }
  }
  
  if (el.label?.text) {
    applyTextStyle(ctx, 14, el.label.style, defaultTextStyle);
    ctx.fillStyle = el.color; 
    ctx.textAlign = "center";
    ctx.fillText(el.label.text, (x1 + x2)/2, (y1 + y2)/2 - 10);
    ctx.shadowBlur = 0;
  }
};

const drawLine = (
  ctx: CanvasRenderingContext2D, 
  el: Element, 
  defaultTextStyle: FontDrawStyle = "rough"
) => {
  applyShapeStyles(ctx, el);
  ctx.beginPath(); 
  ctx.moveTo(el.x, el.y); 
  ctx.lineTo(el.x + el.width, el.y + el.height); 
  ctx.stroke();
  ctx.setLineDash([]);
  
  if (el.label?.text) {
    applyTextStyle(ctx, 14, el.label.style, defaultTextStyle);
    ctx.fillStyle = el.color; 
    ctx.textAlign = "center";
    ctx.fillText(
      el.label.text, 
      el.x + el.width/2, 
      el.y + el.height/2 - 10
    );
    ctx.shadowBlur = 0;
  }
};

const drawPen = (ctx: CanvasRenderingContext2D, el: Element) => {
  if (!el.points || el.points.length < 2) return;
  
  ctx.lineCap = "round"; 
  ctx.lineJoin = "round";
  
  // FIX: Proper highlighter rendering without globalCompositeOperation
  if (el.tool === "highlighter") {
    ctx.globalAlpha = 0.35; 
    ctx.lineWidth = 20;
    ctx.strokeStyle = el.color || "#FFEB3B";
  } else {
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
  }
  
  ctx.beginPath(); 
  ctx.moveTo(el.points[0].x, el.points[0].y);
  
  for (let i = 1; i < el.points.length - 1; i++) {
    const xc = (el.points[i].x + el.points[i + 1].x) / 2;
    const yc = (el.points[i].y + el.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, xc, yc);
  }
  
  ctx.lineTo(
    el.points[el.points.length - 1].x, 
    el.points[el.points.length - 1].y
  );
  ctx.stroke();
  
  // Reset alpha
  if (el.tool === "highlighter") { 
    ctx.globalAlpha = 1; 
  }
  ctx.setLineDash([]);
};

const drawText = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  el: Element, 
  _zoom: number, 
  defaultTextStyle: FontDrawStyle = "rough",
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number
) => {
  const textVal = editingText !== undefined ? editingText : (el.text || "");
  const targetWidth = Math.max(w, 100);
  const targetHeight = Math.max(h, 24);
  const fontSize = el.fontSize || Math.max(16, targetHeight * 0.6);
  const userLineHeight = el.lineHeight || 1.2;
  const align = el.textAlign || "left";
  
  applyTextStyle(ctx, fontSize, el.textStyle, defaultTextStyle, el.bold, el.italic, el.fontFamily);
  ctx.fillStyle = el.color;
  ctx.textBaseline = "middle"; 
  ctx.textAlign = align as CanvasTextAlign;
  
  const padding = 8;
  const paragraphs = textVal.split("\n");
  let currentOffset = 0;
  const lines: WrappedLine[] = [];
  paragraphs.forEach(p => {
    const wrapped = wrapTextWithRanges(ctx, p, targetWidth - padding * 2, currentOffset);
    lines.push(...wrapped);
    currentOffset += p.length + 1;
  });
  
  const lineHeight = fontSize * userLineHeight;
  const totalTextHeight = lines.length * lineHeight;
  const startY = y + (targetHeight - totalTextHeight) / 2 + lineHeight / 2;
  
  let startX = x + padding;
  if (align === "center") startX = x + targetWidth / 2;
  else if (align === "right") startX = x + targetWidth - padding;

  lines.forEach((line, i) => { 
    ctx.fillText(line.text, startX, startY + i * lineHeight); 
  });

  // Render blinking caret/cursor on canvas
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
      targetWidth
    );

    ctx.beginPath();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 2;
    ctx.moveTo(coords.x + 1, coords.y - fontSize / 2);
    ctx.lineTo(coords.x + 1, coords.y + fontSize / 2);
    ctx.stroke();
  }
  
  ctx.shadowBlur = 0;
};

const drawIcon = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  el: Element
) => {
  if (el.svgPaths && el.svgPaths.length > 0 && el.viewBox) {
    ctx.save(); 
    ctx.translate(x, y);
    
    const [vbX, vbY, vbW, vbH] = el.viewBox.split(' ').map(Number);
    const scale = Math.min(w / vbW, h / vbH);
    
    ctx.translate((w - vbW * scale) / 2, (h - vbH * scale) / 2); 
    ctx.scale(scale, scale); 
    ctx.translate(-vbX, -vbY);
    
    ctx.fillStyle = el.iconColor || el.color || "#000"; 
    ctx.strokeStyle = "transparent";
    
    el.svgPaths.forEach((pathStr) => drawSvgElement(ctx, pathStr));
    ctx.restore();
  }
};

// =========================================================
// 4. CONNECTOR ROUTING PHYSICS
// =========================================================

export const renderConnector = (
  ctx: CanvasRenderingContext2D,
  sourceEl: Element | TextElement,
  targetEl: Element | TextElement,
  connector: Connector,
  _zoom: number = 1,
  _defaultTextStyle: FontDrawStyle = "rough"
) => {
  ctx.save();
  
  const { s: sourceAnchor, t: targetAnchor } = findBestAnchors(sourceEl, targetEl);
  const sourceX = sourceAnchor.x;
  const sourceY = sourceAnchor.y;
  const targetX = targetAnchor.x;
  const targetY = targetAnchor.y;
  
  ctx.strokeStyle = connector.color || "#000";
  ctx.lineWidth = connector.strokeWidth || 2;
  ctx.lineCap = "round"; 
  ctx.lineJoin = "round";
  
  if (connector.lineStyle === "dashed") {
    ctx.setLineDash([8, 4]);
  } else if (connector.lineStyle === "dotted") {
    ctx.setLineDash([2, 4]);
  } else {
    ctx.setLineDash([]);
  }

  const { cp1x, cp1y, cp2x, cp2y } = getConnectorControlPoints(sourceAnchor, targetAnchor);

  // Draw bezier curve
  ctx.beginPath();
  ctx.moveTo(sourceX, sourceY);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, targetX, targetY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw arrow head
  if (connector.arrowStyle !== "none") {
    const angle = Math.atan2(targetY - cp2y, targetX - cp2x); 
    const headLen = 15;
    
    ctx.beginPath();
    if (connector.arrowStyle === "filled") {
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(
        targetX - headLen * Math.cos(angle - Math.PI / 6), 
        targetY - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        targetX - headLen * Math.cos(angle + Math.PI / 6), 
        targetY - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath(); 
      ctx.fillStyle = connector.color || "#000"; 
      ctx.fill();
    } else {
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(
        targetX - headLen * Math.cos(angle - Math.PI / 6), 
        targetY - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(
        targetX - headLen * Math.cos(angle + Math.PI / 6), 
        targetY - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }
  }

  if (connector.label) {
    const t = 0.5;
    const mt = 1 - t;
    const bx = mt * mt * mt * sourceX + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * targetX;
    const by = mt * mt * mt * sourceY + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * targetY;

    ctx.save();
    applyTextStyle(ctx, 11, connector.labelStyle, _defaultTextStyle);
    ctx.fillStyle = connector.color || "#1e293b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textWidth = ctx.measureText(connector.label).width;
    const padX = 6;
    const padY = 4;
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.roundRect(bx - textWidth / 2 - padX, by - 8 - padY, textWidth + padX * 2, 16 + padY * 2, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(203, 213, 225, 0.6)"; 
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = connector.color || "#1e293b";
    ctx.fillText(connector.label, bx, by);
    ctx.restore();
  }

  if (connector.isSelected) {
    ctx.save();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.25)";
    ctx.lineWidth = (connector.strokeWidth || 2) + 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, targetX, targetY);
    ctx.stroke();

    ctx.fillStyle = "#3b82f6";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, targetY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  
  ctx.restore();
};

// =========================================================
// 5. SELECTION & RESHAPE HANDLES UI
// =========================================================

const getReshapeHandles = (
  el: Element, 
  _zoom: number
): { handle: ReshapeHandle; x: number; y: number }[] => {
  if (el.tool === "pen" && el.points && el.points.length > 0) {
    return [
      { 
        handle: "start-point" as ReshapeHandle, 
        x: el.points[0].x, 
        y: el.points[0].y 
      },
      { 
        handle: "end-point" as ReshapeHandle, 
        x: el.points[el.points.length - 1].x, 
        y: el.points[el.points.length - 1].y 
      },
    ];
  }
  
  if (el.tool === "line" || el.tool === "arrow") {
    return [
      { handle: "start-point" as ReshapeHandle, x: el.x, y: el.y },
      { 
        handle: "end-point" as ReshapeHandle, 
        x: el.x + el.width, 
        y: el.y + el.height 
      },
    ];
  }
  
  const x = el.width < 0 ? el.x + el.width : el.x;
  const y = el.height < 0 ? el.y + el.height : el.y;
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  
  return [
    { handle: "top-left" as ReshapeHandle, x, y }, 
    { handle: "top-center" as ReshapeHandle, x: x + w/2, y }, 
    { handle: "top-right" as ReshapeHandle, x: x + w, y },
    { handle: "middle-left" as ReshapeHandle, x, y: y + h/2 }, 
    { handle: "middle-right" as ReshapeHandle, x: x + w, y: y + h/2 },
    { handle: "bottom-left" as ReshapeHandle, x, y: y + h }, 
    { handle: "bottom-center" as ReshapeHandle, x: x + w/2, y: y + h }, 
    { handle: "bottom-right" as ReshapeHandle, x: x + w, y: y + h },
  ];
};

export const getReshapeHandleAtPoint = (
  px: number, 
  py: number, 
  el: Element, 
  zoom: number, 
  handleSize: number = 8
): ReshapeHandle | null => {
  const handles = getReshapeHandles(el, zoom);
  const threshold = handleSize / zoom;
  
  for (const h of handles) {
    if (Math.abs(px - h.x) < threshold && Math.abs(py - h.y) < threshold) {
      return h.handle;
    }
  }
  
  return null;
};

const drawReshapeHandle = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  handle: ReshapeHandle, 
  zoom: number
) => {
  const size = 8 / zoom;
  const half = size / 2;
  
  if (handle === "start-point" || handle === "end-point") {
    ctx.fillStyle = "#fff"; 
    ctx.strokeStyle = "#3b82f6"; 
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath(); 
    ctx.arc(x, y, half + 1, 0, Math.PI * 2); 
    ctx.fill(); 
    ctx.stroke();
  } else if (
    handle === "top-center" || 
    handle === "bottom-center" || 
    handle === "middle-left" || 
    handle === "middle-right"
  ) {
    // Styled as connection anchor port (blue circle with white border)
    ctx.fillStyle = "#3b82f6";
    ctx.strokeStyle = "#ffffff"; 
    ctx.lineWidth = 1.2 / zoom;
    ctx.beginPath(); 
    ctx.arc(x, y, half + 1.2, 0, Math.PI * 2); 
    ctx.fill(); 
    ctx.stroke();
  } else {
    // Corner resize handles (white square with blue border)
    ctx.fillStyle = "#fff"; 
    ctx.strokeStyle = "#3b82f6"; 
    ctx.lineWidth = 1.5 / zoom;
    ctx.fillRect(x - half, y - half, size, size); 
    ctx.strokeRect(x - half, y - half, size, size);
  }
};

const drawSelectionUI = (
  ctx: CanvasRenderingContext2D, 
  el: Element, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  zoom: number
) => {
  // Selection box
  ctx.setLineDash([6, 4]); 
  ctx.strokeStyle = "#3b82f6"; 
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(x - 4/zoom, y - 4/zoom, w + 8/zoom, h + 8/zoom); 
  ctx.setLineDash([]);
  
  // Reshape handles
  getReshapeHandles(el, zoom).forEach(h => {
    drawReshapeHandle(ctx, h.x, h.y, h.handle, zoom);
  });
  
  // Lock indicator
  if (el.locked) { 
    ctx.font = `${12/zoom}px sans-serif`; 
    ctx.textAlign = "center"; 
    ctx.fillStyle = "#ef4444"; 
    ctx.fillText("🔒", x + w/2, y - 8/zoom); 
  }
};

const drawCommentElement = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  el: Element,
  index: number
) => {
  ctx.save();
  
  // Speech bubble path
  ctx.beginPath();
  const radius = Math.min(w, h, 8); // rounded corners
  // Draw rounded rectangle
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  // Tail pointing to bottom-left
  ctx.lineTo(x + radius + 10, y + h);
  ctx.lineTo(x + 5, y + h + 8);
  ctx.lineTo(x + radius, y + h - 4);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fillStyle = el.fillColor || "#facc15";
  ctx.fill();
  ctx.strokeStyle = el.color || "#ca8a04";
  ctx.lineWidth = el.strokeWidth || 1.5;
  ctx.stroke();

  // Draw comment index or comment icon
  ctx.fillStyle = "#333333";
  ctx.font = `bold ${Math.min(w, h) * 0.4}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`💬 ${index}`, x + w / 2, y + h / 2);
  ctx.restore();
};

// =========================================================
// 6. MAIN RENDER FUNCTION
// =========================================================

export const renderElement = (
  ctx: CanvasRenderingContext2D, 
  el: Element, 
  zoom: number = 1, 
  defaultTextStyle: FontDrawStyle = "rough", 
  editingElementId?: string | null,
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number,
  allElements?: Element[]
) => {
  ctx.save();
  
  const x = el.width < 0 ? el.x + el.width : el.x;
  const y = el.height < 0 ? el.y + el.height : el.y;
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  
  ctx.globalAlpha = el.opacity ?? 1;

  const isEditingThis = el.id === editingElementId;
  const currentEditingText = isEditingThis ? editingText : undefined;
  const currentCaretVisible = isEditingThis ? caretVisible : undefined;
  const currentCaretIndex = isEditingThis ? caretIndex : undefined;

  switch (el.tool) {
    case "rect": 
      drawRect(ctx, x, y, w, h, el, defaultTextStyle, currentEditingText, currentCaretVisible, currentCaretIndex); 
      break;
    case "circle": 
      drawEllipse(ctx, x, y, w, h, el, defaultTextStyle, currentEditingText, currentCaretVisible, currentCaretIndex); 
      break;
    case "diamond": 
      drawDiamond(ctx, x, y, w, h, el, defaultTextStyle, currentEditingText, currentCaretVisible, currentCaretIndex); 
      break;
    case "cylinder": 
      drawCylinder(ctx, x, y, w, h, el, defaultTextStyle, currentEditingText, currentCaretVisible, currentCaretIndex); 
      break;
    case "arrow": 
      drawArrow(ctx, el, defaultTextStyle); 
      break;
    case "line": 
      drawLine(ctx, el, defaultTextStyle); 
      break;
    case "pen": 
    case "highlighter": 
      drawPen(ctx, el); 
      break;
    case "text": 
      drawText(ctx, x, y, w, h, el, zoom, defaultTextStyle, currentEditingText, currentCaretVisible, currentCaretIndex); 
      break;
    case "icon": 
      drawIcon(ctx, x, y, w, h, el); 
      break;
    case "comment": {
      const commentIndex = allElements
        ? allElements.filter(e => e.tool === "comment").indexOf(el) + 1
        : 1;
      drawCommentElement(ctx, x, y, w, h, el, commentIndex);
      break;
    }
  }

  // Selection UI
  if (el.isSelected && el.id !== editingElementId) {
    let bx = x;
    let by = y;
    let bw = w;
    let bh = h;
    
    // Calculate bounds for pen tool
    if (el.tool === "pen" && el.points && el.points.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      
      el.points.forEach(p => { 
        minX = Math.min(minX, p.x); 
        minY = Math.min(minY, p.y); 
        maxX = Math.max(maxX, p.x); 
        maxY = Math.max(maxY, p.y); 
      });
      
      bx = minX; 
      by = minY; 
      bw = maxX - minX; 
      bh = maxY - minY;
    }
    
    drawSelectionUI(ctx, el, bx, by, bw, bh, zoom);
  }
  
  ctx.restore();
};

// =========================================================
// 7. VIEWPORT CULLING
// =========================================================

export const getVisibleElements = (
  elements: Element[], 
  pan: { x: number; y: number }, 
  zoom: number
): Element[] => {
  const vx = -pan.x / zoom;
  const vy = -pan.y / zoom;
  const vw = window.innerWidth / zoom;
  const vh = window.innerHeight / zoom;
  
  return elements.filter(el => {
    const bx = el.width < 0 ? el.x + el.width : el.x;
    const by = el.height < 0 ? el.y + el.height : el.y;
    const bw = Math.abs(el.width) || 1;
    const bh = Math.abs(el.height) || 1;
    
    return bx + bw >= vx && 
           bx <= vx + vw && 
           by + bh >= vy && 
           by <= vy + vh;
  });
};

// =========================================================
// 8. LAYERED CANVAS RENDER
// =========================================================

// =========================================================
// 9. TEXT ELEMENTS RENDERING
// =========================================================

export const renderTextElements = (
  ctx: CanvasRenderingContext2D,
  textElements: TextElement[],
  zoom: number = 1,
  defaultTextStyle: FontDrawStyle = "rough",
  editingTextElementId?: string | null,
  editingTextElementText?: string,
  caretVisible?: boolean,
  caretIndex?: number,
  pan?: { x: number; y: number }
) => {
  let visibleTextElements = textElements;
  if (pan) {
    const vx = -pan.x / zoom;
    const vy = -pan.y / zoom;
    const vw = window.innerWidth / zoom;
    const vh = window.innerHeight / zoom;
    visibleTextElements = textElements.filter(el => {
      return el.x + el.width >= vx &&
             el.x <= vx + vw &&
             el.y + el.height >= vy &&
             el.y <= vy + vh;
    });
  }

  visibleTextElements.forEach(textEl => {
    const isEditingThis = textEl.id === editingTextElementId;
    const currentEditingText = isEditingThis ? editingTextElementText : undefined;
    const currentCaretVisible = isEditingThis ? caretVisible : undefined;
    const currentCaretIndex = isEditingThis ? caretIndex : undefined;
    ctx.save();
    renderTextElement(ctx, textEl, zoom, defaultTextStyle, currentEditingText, currentCaretVisible, currentCaretIndex);
    ctx.restore();
  });
};

export interface CanvasLayers {
  background: HTMLCanvasElement; connectors: HTMLCanvasElement;
  nodes: HTMLCanvasElement; overlays: HTMLCanvasElement;
}

export const renderLayers = (
  layers: CanvasLayers, elements: Element[], connectors: Connector[],
  pan: { x: number; y: number }, zoom: number, showGrid: boolean, bgTheme: string,
  guides: { id: string; type: "horizontal" | "vertical"; position: number }[],
  comments: { id: string; x: number; y: number; text: string; author: string; timestamp: number; resolved: boolean }[],
  rubberBand: { x1: number; y1: number; x2: number; y2: number } | null,
  connectionPreview: { sourceId: string; sourceAnchor: string; targetId: string | null; mousePos: Point } | null,
  defaultTextStyle: FontDrawStyle = "rough",
  editingElementId?: string | null,
  editingText?: string,
  caretVisible?: boolean,
  caretIndex?: number,
  textElements: TextElement[] = []
) => {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;

  // Layer 1: Background/Grid
  const bgCtx = layers.background.getContext("2d");
  if (bgCtx) {
    layers.background.width = w * dpr; layers.background.height = h * dpr;
    layers.background.style.width = `${w}px`; layers.background.style.height = `${h}px`;
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0); bgCtx.clearRect(0, 0, w, h);
    bgCtx.fillStyle = (bgTheme === "dark" || bgTheme === "dark-grid") ? "#1a1a2e" : "#ffffff";
    bgCtx.fillRect(0, 0, w, h);
    if (showGrid && bgTheme.includes("grid")) drawGrid(bgCtx, w, h, pan, zoom, bgTheme);
    guides.forEach(g => {
      bgCtx.strokeStyle = "#3b82f6"; bgCtx.lineWidth = 1 / zoom; bgCtx.setLineDash([4/zoom, 4/zoom]); bgCtx.beginPath();
      if (g.type === "horizontal") { bgCtx.moveTo(-10000, g.position); bgCtx.lineTo(10000, g.position); }
      else { bgCtx.moveTo(g.position, -10000); bgCtx.lineTo(g.position, 10000); }
      bgCtx.stroke(); bgCtx.setLineDash([]);
    });
  }

  // Layer 2: Connectors
  const connCtx = layers.connectors.getContext("2d");
  if (connCtx) {
    layers.connectors.width = w * dpr; layers.connectors.height = h * dpr;
    layers.connectors.style.width = `${w}px`; layers.connectors.style.height = `${h}px`;
    connCtx.setTransform(dpr, 0, 0, dpr, 0, 0); connCtx.clearRect(0, 0, w, h);
    connCtx.save(); connCtx.translate(pan.x, pan.y); connCtx.scale(zoom, zoom);
    connectors.forEach(conn => {
      const sourceEl = elements.find(el => el.id === conn.sourceId) || textElements.find(el => el.id === conn.sourceId);
      const targetEl = elements.find(el => el.id === conn.targetId) || textElements.find(el => el.id === conn.targetId);
      if (sourceEl && targetEl) renderConnector(connCtx, sourceEl, targetEl, conn, zoom, defaultTextStyle);
    });
    if (connectionPreview && !connectionPreview.targetId) {
      connCtx.strokeStyle = "#3b82f6"; connCtx.lineWidth = 2; connCtx.setLineDash([6, 4]);
      const sourceEl = elements.find(el => el.id === connectionPreview.sourceId) || textElements.find(el => el.id === connectionPreview.sourceId);
      if (sourceEl) {
        connCtx.beginPath();
        connCtx.moveTo(sourceEl.x + sourceEl.width / 2, sourceEl.y + sourceEl.height / 2);
        connCtx.lineTo(connectionPreview.mousePos.x, connectionPreview.mousePos.y);
        connCtx.stroke(); connCtx.setLineDash([]);
      }
    }
    connCtx.restore();
  }

  // Layer 3: Nodes/Elements
  const visibleElements = getVisibleElements(elements, pan, zoom);
  const nodeCtx = layers.nodes.getContext("2d");
  if (nodeCtx) {
    layers.nodes.width = w * dpr; layers.nodes.height = h * dpr;
    layers.nodes.style.width = `${w}px`; layers.nodes.style.height = `${h}px`;
    nodeCtx.setTransform(dpr, 0, 0, dpr, 0, 0); nodeCtx.clearRect(0, 0, w, h);
    nodeCtx.save(); nodeCtx.translate(pan.x, pan.y); nodeCtx.scale(zoom, zoom);
    visibleElements.forEach(el => renderElement(nodeCtx, el, zoom, defaultTextStyle, editingElementId, editingText, caretVisible, caretIndex, elements));
    comments.filter(c => !c.resolved).forEach((c, i) => {
      nodeCtx.beginPath(); nodeCtx.arc(c.x, c.y, 10/zoom, 0, Math.PI*2);
      nodeCtx.fillStyle = "#facc15"; nodeCtx.fill();
      nodeCtx.strokeStyle = "#ca8a04"; nodeCtx.lineWidth = 1.5/zoom; nodeCtx.stroke();
      nodeCtx.fillStyle = "#000"; nodeCtx.font = `${10/zoom}px sans-serif`;
      nodeCtx.textAlign = "center"; nodeCtx.textBaseline = "middle";
      nodeCtx.fillText(`${i+1}`, c.x, c.y);
    });
    nodeCtx.restore();
  }

  // Layer 4: Overlays
  const overlayCtx = layers.overlays.getContext("2d");
  if (overlayCtx) {
    layers.overlays.width = w * dpr; layers.overlays.height = h * dpr;
    layers.overlays.style.width = `${w}px`; layers.overlays.style.height = `${h}px`;
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0); overlayCtx.clearRect(0, 0, w, h);
    overlayCtx.save(); overlayCtx.translate(pan.x, pan.y); overlayCtx.scale(zoom, zoom);
    if (rubberBand) {
      const rx = Math.min(rubberBand.x1, rubberBand.x2), ry = Math.min(rubberBand.y1, rubberBand.y2);
      const rw = Math.abs(rubberBand.x2 - rubberBand.x1), rh = Math.abs(rubberBand.y2 - rubberBand.y1);
      overlayCtx.fillStyle = "rgba(59,130,246,0.1)"; overlayCtx.strokeStyle = "#3b82f6"; overlayCtx.lineWidth = 1.5/zoom;
      overlayCtx.setLineDash([4/zoom,4/zoom]); overlayCtx.fillRect(rx,ry,rw,rh);
      overlayCtx.strokeRect(rx,ry,rw,rh); overlayCtx.setLineDash([]);
    }
    overlayCtx.restore();
  }
};
