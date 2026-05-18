import type { Element } from "./types";

// =========================================================
// 1. GRID DRAWING
// =========================================================

export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number
) => {
  const gridSize = 20;
  ctx.save();
  ctx.strokeStyle = bgTheme === "dark-grid" ? "#333355" : "#e0e0e0";
  ctx.lineWidth = 1 / zoom;
  const startX = Math.floor((-pan.x / zoom) / gridSize) * gridSize;
  const startY = Math.floor((-pan.y / zoom) / gridSize) * gridSize;
  const endX = startX + width / zoom + gridSize;
  const endY = startY + height / zoom + gridSize;
  ctx.beginPath();
  for (let x = startX; x < endX; x += gridSize) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
  for (let y = startY; y < endY; y += gridSize) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
  ctx.stroke();
  ctx.restore();
};

let bgTheme = "light-grid";
export const setBgTheme = (t: string) => { bgTheme = t; };

// =========================================================
// 2. HELPERS
// =========================================================

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(' '); const lines: string[] = []; let currentLine = words[0] || '';
  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width < maxWidth) currentLine = testLine;
    else { lines.push(currentLine); currentLine = words[i]; }
  }
  lines.push(currentLine); return lines;
};

const drawSvgElement = (ctx: CanvasRenderingContext2D, d: string) => {
  const path = new Path2D(d); ctx.fill(path); ctx.stroke(path);
};

const applyShapeStyles = (ctx: CanvasRenderingContext2D, el: Element) => {
  ctx.lineWidth = el.strokeWidth;
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.fillColor || "transparent";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Dashed/dotted lines (improvement 17)
  if (el.lineStyle === "dashed") ctx.setLineDash([8, 4]);
  else if (el.lineStyle === "dotted") ctx.setLineDash([2, 4]);
  else ctx.setLineDash([]);
};

// =========================================================
// 3. ELEMENT RENDERERS
// =========================================================

const drawRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, el: Element) => {
  applyShapeStyles(ctx, el);
  // Rotation (improvement 37 - sticky notes)
  if (el.rotation) { ctx.save(); ctx.translate(x+w/2, y+h/2); ctx.rotate(el.rotation * Math.PI / 180); ctx.translate(-(x+w/2), -(y+h/2)); }
  // Shadow for sticky notes
  if (el.fillColor === "#FFD700") { ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; }
  if (el.fillColor) ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  // Draw image if present (improvement 26)
  if (el.imageData && typeof el.imageData === 'string') {
    const img = new Image(); img.src = el.imageData;
    if (img.complete) ctx.drawImage(img, x, y, w, h);
    else img.onload = () => { ctx.save(); ctx.drawImage(img, x, y, w, h); ctx.restore(); };
  }
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  if (el.rotation) ctx.restore();
  // Draw label text (improvement 35)
  if (el.label?.text) {
    ctx.fillStyle = el.color; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(el.label.text, x + w/2 + (el.label.offsetX||0), y + (el.label.offsetY||-10));
  }
};

const drawEllipse = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, el: Element) => {
  applyShapeStyles(ctx, el);
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  if (el.fillColor) ctx.fill();
  ctx.stroke();
  if (el.label?.text) { ctx.fillStyle = el.color; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.fillText(el.label.text, x+w/2 + (el.label.offsetX||0), y + (el.label.offsetY||-10)); }
};

const drawDiamond = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, el: Element) => {
  applyShapeStyles(ctx, el);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  if (el.fillColor) ctx.fill();
  ctx.stroke();
};

const drawArrow = (ctx: CanvasRenderingContext2D, el: Element) => {
  const x1 = el.x, y1 = el.y, x2 = el.x + el.width, y2 = el.y + el.height;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 15;
  applyShapeStyles(ctx, el);
  // Draw line with arrow style consideration
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  
  // Custom arrowheads (improvement 18)
  if (el.arrowStyle !== "none") {
    ctx.beginPath();
    if (el.arrowStyle === "filled") {
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath(); ctx.fillStyle = el.color; ctx.fill();
    } else {
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  }
  if (el.label?.text) { ctx.fillStyle = el.color; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.fillText(el.label.text, (x1+x2)/2, (y1+y2)/2 - 10); }
};

const drawLine = (ctx: CanvasRenderingContext2D, el: Element) => {
  applyShapeStyles(ctx, el);
  ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + el.width, el.y + el.height); ctx.stroke();
  ctx.setLineDash([]);
  if (el.label?.text) { ctx.fillStyle = el.color; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.fillText(el.label.text, el.x+el.width/2, el.y+el.height/2 - 10); }
};

const drawPen = (ctx: CanvasRenderingContext2D, el: Element) => {
  if (!el.points || el.points.length < 2) return;
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // Highlighter mode (improvement 38)
  if (el.tool === "highlighter") {
    ctx.globalAlpha = 0.3;
    ctx.globalCompositeOperation = 'multiply';
    ctx.lineWidth = 20;
    ctx.strokeStyle = "#FFEB3B";
  }
  ctx.beginPath(); ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length - 1; i++) {
    const xc = (el.points[i].x + el.points[i + 1].x) / 2;
    const yc = (el.points[i].y + el.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, xc, yc);
  }
  ctx.lineTo(el.points[el.points.length - 1].x, el.points[el.points.length - 1].y);
  ctx.stroke();
  if (el.tool === "highlighter") { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  ctx.setLineDash([]);
};

const drawText = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, el: Element, zoom: number) => {
  if (w === 0 && h === 0) return;
  const fontSize = Math.max(16, h * 0.6);
  ctx.font = `${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = el.color;
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const padding = 8;
  const lines = wrapText(ctx, el.text || "", (w || 100) - padding * 2);
  const lineHeight = fontSize * 1.2;
  const totalTextHeight = lines.length * lineHeight;
  const startY = y + ((h||50) - totalTextHeight) / 2 + lineHeight / 2;
  lines.forEach((line, i) => { ctx.fillText(line, x + padding, startY + i * lineHeight); });
};

const drawIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, el: Element) => {
  if (el.svgPaths && el.svgPaths.length > 0 && el.viewBox) {
    ctx.save(); ctx.translate(x, y);
    const [vbX, vbY, vbW, vbH] = el.viewBox.split(' ').map(Number);
    const scale = Math.min(w / vbW, h / vbH);
    const offsetX = (w - vbW * scale) / 2, offsetY = (h - vbH * scale) / 2;
    ctx.translate(offsetX, offsetY); ctx.scale(scale, scale); ctx.translate(-vbX, -vbY);
    ctx.fillStyle = el.iconColor || el.color || "#000"; ctx.strokeStyle = "transparent";
    el.svgPaths.forEach((pathStr) => drawSvgElement(ctx, pathStr));
    ctx.restore();
  } else {
    ctx.fillStyle = "#e5e7eb"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#9ca3af"; ctx.font = "14px Inter, sans-serif";
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillText("Icon", x + w/2, y + h/2);
  }
};

// =========================================================
// 4. SELECTION & RESIZE HANDLES UI
// =========================================================

const drawSelectionUI = (ctx: CanvasRenderingContext2D, el: Element, x: number, y: number, w: number, h: number, zoom: number) => {
  const dashOffset = (Date.now() / 50) % 16;
  ctx.setLineDash([6, 4]); ctx.lineDashOffset = -dashOffset;
  ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(x - 4/zoom, y - 4/zoom, w + 8/zoom, h + 8/zoom);
  ctx.setLineDash([]);

  const handleSize = 8 / zoom;
  const handles = [
    { x: x, y: y }, { x: x + w/2, y: y }, { x: x + w, y: y },
    { x: x + w, y: y + h/2 }, { x: x + w, y: y + h },
    { x: x + w/2, y: y + h }, { x: x, y: y + h }, { x: x, y: y + h/2 },
  ];
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5 / zoom;
  handles.forEach(hd => { ctx.fillRect(hd.x - handleSize/2, hd.y - handleSize/2, handleSize, handleSize); ctx.strokeRect(hd.x - handleSize/2, hd.y - handleSize/2, handleSize, handleSize); });

  // Lock icon (improvement 12)
  if (el.locked) {
    ctx.font = `${12/zoom}px sans-serif`; ctx.textAlign = "center";
    ctx.fillStyle = "#ef4444"; ctx.fillText("🔒", x + w/2, y - 8/zoom);
  }

  // Connection anchor
  if (el.tool !== "line" && el.tool !== "arrow" && el.tool !== "pen") {
    ctx.beginPath(); ctx.arc(x + w + 6/zoom, y + h / 2, 5/zoom, 0, Math.PI * 2);
    ctx.shadowColor = "#3b82f6"; ctx.shadowBlur = 4/zoom; ctx.fillStyle = "#3b82f6"; ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5/zoom; ctx.stroke();
  }
};

// =========================================================
// 5. MAIN RENDER FUNCTION
// =========================================================

export const renderElement = (ctx: CanvasRenderingContext2D, el: Element, zoom: number = 1) => {
  ctx.save();
  const x = el.width < 0 ? el.x + el.width : el.x;
  const y = el.height < 0 ? el.y + el.height : el.y;
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  ctx.globalAlpha = el.opacity ?? 1;

  switch (el.tool) {
    case "rect":       drawRect(ctx, x, y, w, h, el); break;
    case "circle":     drawEllipse(ctx, x, y, w, h, el); break;
    case "diamond":    drawDiamond(ctx, x, y, w, h, el); break;
    case "arrow":      drawArrow(ctx, el); break;
    case "line":       drawLine(ctx, el); break;
    case "pen":        drawPen(ctx, el); break;
    case "highlighter": drawPen(ctx, el); break;
    case "text":       drawText(ctx, x, y, w, h, el, zoom); break;
    case "icon":       drawIcon(ctx, x, y, w, h, el); break;
  }

  if (el.isSelected) {
    let bx = x, by = y, bw = w, bh = h;
    if (el.tool === "pen" && el.points && el.points.length > 0) {
      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      el.points.forEach(p => { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); });
      bx=minX; by=minY; bw=maxX-minX; bh=maxY-minY;
    }
    drawSelectionUI(ctx, el, bx, by, bw, bh, zoom);
  }
  ctx.restore();
};

// Viewport culling helper (improvement 48)
export const getVisibleElements = (elements: Element[], pan: {x:number,y:number}, zoom: number): Element[] => {
  const vx = -pan.x/zoom, vy = -pan.y/zoom, vw = window.innerWidth/zoom, vh = window.innerHeight/zoom;
  return elements.filter(el => {
    const bx = el.width < 0 ? el.x+el.width : el.x;
    const by = el.height < 0 ? el.y+el.height : el.y;
    const bw = Math.abs(el.width) || 1, bh = Math.abs(el.height) || 1;
    return bx + bw >= vx && bx <= vx + vw && by + bh >= vy && by <= vy + vh;
  });
};