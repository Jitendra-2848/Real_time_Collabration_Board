import type { Element } from "./types";
import { getBoundingBox, getResizeHandles } from "./utils";

export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number
) => {
  const gridSize = 20;

  ctx.save();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1 / zoom;

  const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize;
  const startY = Math.floor(-pan.y / zoom / gridSize) * gridSize;
  const endX = startX + width / zoom + gridSize;
  const endY = startY + height / zoom + gridSize;

  ctx.beginPath();

  for (let x = startX; x < endX; x += gridSize) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }

  for (let y = startY; y < endY; y += gridSize) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }

  ctx.stroke();
  ctx.restore();
};

const drawTextCentered = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.restore();
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

export const renderElement = (
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom = 1
) => {
  ctx.save();

  ctx.globalAlpha = el.opacity ?? 1;
  ctx.strokeStyle = el.color;
  ctx.lineWidth = Math.max(el.strokeWidth, 1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const box = getBoundingBox(el);

  switch (el.tool) {
    case "rect": {
      if (el.fillColor && el.fillColor !== "transparent") {
        ctx.fillStyle = el.fillColor;
        ctx.fillRect(box.x, box.y, box.width, box.height);
      }

      ctx.strokeRect(box.x, box.y, box.width, box.height);

      if (el.text) {
        drawTextCentered(ctx, el.text, box.x, box.y, box.width, box.height, el.color);
      }

      break;
    }

    case "circle": {
      ctx.beginPath();
      ctx.ellipse(
        box.x + box.width / 2,
        box.y + box.height / 2,
        Math.max(box.width / 2, 1),
        Math.max(box.height / 2, 1),
        0,
        0,
        Math.PI * 2
      );

      if (el.fillColor && el.fillColor !== "transparent") {
        ctx.fillStyle = el.fillColor;
        ctx.fill();
      }

      ctx.stroke();

      if (el.text) {
        drawTextCentered(ctx, el.text, box.x, box.y, box.width, box.height, el.color);
      }

      break;
    }

    case "diamond": {
      ctx.beginPath();
      ctx.moveTo(box.x + box.width / 2, box.y);
      ctx.lineTo(box.x + box.width, box.y + box.height / 2);
      ctx.lineTo(box.x + box.width / 2, box.y + box.height);
      ctx.lineTo(box.x, box.y + box.height / 2);
      ctx.closePath();

      if (el.fillColor && el.fillColor !== "transparent") {
        ctx.fillStyle = el.fillColor;
        ctx.fill();
      }

      ctx.stroke();

      if (el.text) {
        drawTextCentered(ctx, el.text, box.x, box.y, box.width, box.height, el.color);
      }

      break;
    }

    case "line": {
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x + el.width, el.y + el.height);
      ctx.stroke();
      break;
    }

    case "arrow": {
      const x1 = el.x;
      const y1 = el.y;
      const x2 = el.x + el.width;
      const y2 = el.y + el.height;

      let arrowAngle = Math.atan2(y2 - y1, x2 - x1);

      if (el.curveOffset && Math.abs(el.curveOffset) > 1) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const baseAngle = Math.atan2(y2 - y1, x2 - x1);

        const cx = midX + Math.cos(baseAngle + Math.PI / 2) * el.curveOffset;
        const cy = midY + Math.sin(baseAngle + Math.PI / 2) * el.curveOffset;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cx, cy, x2, y2);
        ctx.stroke();

        arrowAngle = Math.atan2(y2 - cy, x2 - cx);
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      const headLen = 16;

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(arrowAngle - Math.PI / 6),
        y2 - headLen * Math.sin(arrowAngle - Math.PI / 6)
      );
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(arrowAngle + Math.PI / 6),
        y2 - headLen * Math.sin(arrowAngle + Math.PI / 6)
      );
      ctx.stroke();

      break;
    }

    case "pen": {
      if (el.points && el.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);

        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }

        ctx.stroke();
      }

      break;
    }

    case "text": {
      if (el.text) {
        ctx.fillStyle = el.color;
        ctx.font = `${Math.max(16, el.strokeWidth * 5)}px Inter, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(el.text, el.x, el.y);
      }

      break;
    }

    case "icon": {
      drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 12);

      ctx.fillStyle = el.fillColor || "#ffffff";
      ctx.fill();

      ctx.strokeStyle = el.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (el.iconPath) {
        ctx.save();

        const padding = 10;
        const iconSize = Math.min(box.width, box.height) - padding * 2;

        ctx.translate(
          box.x + box.width / 2 - iconSize / 2,
          box.y + box.height / 2 - iconSize / 2
        );

        ctx.scale(iconSize / 24, iconSize / 24);

        ctx.fillStyle = el.iconColor || el.color;

        try {
          const path = new Path2D(el.iconPath);
          ctx.fill(path);
        } catch {
          ctx.font = "bold 20px Inter, sans-serif";
          ctx.fillText(el.iconName?.[0] || "?", 8, 16);
        }

        ctx.restore();
      } else if (el.iconName) {
        ctx.fillStyle = el.iconColor || el.color;
        ctx.font = "bold 20px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.iconName[0].toUpperCase(), box.x + box.width / 2, box.y + box.height / 2);
      }

      break;
    }
  }

  if (el.isSelected) {
    const selectedBox = getBoundingBox(el);

    ctx.save();

    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2 / zoom;

    ctx.strokeRect(
      selectedBox.x - 5 / zoom,
      selectedBox.y - 5 / zoom,
      selectedBox.width + 10 / zoom,
      selectedBox.height + 10 / zoom
    );

    ctx.setLineDash([]);

    const handles = getResizeHandles(el, zoom);

    Object.entries(handles).forEach(([key, handle]) => {
      ctx.fillStyle = key === "middle" ? "#f97316" : "#ffffff";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2 / zoom;

      ctx.fillRect(handle.x, handle.y, handle.width, handle.height);
      ctx.strokeRect(handle.x, handle.y, handle.width, handle.height);
    });

    // For curved arrow, show real curve control point.
    if (el.tool === "arrow" && el.curveOffset) {
      const x1 = el.x;
      const y1 = el.y;
      const x2 = el.x + el.width;
      const y2 = el.y + el.height;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const angle = Math.atan2(y2 - y1, x2 - x1);

      const cx = midX + Math.cos(angle + Math.PI / 2) * el.curveOffset;
      const cy = midY + Math.sin(angle + Math.PI / 2) * el.curveOffset;

      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(cx, cy, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.restore();
};