import type { Element, Point } from "../lib/types";
import { getElementBounds } from "../lib/utils";

export const exportCanvasToPNG = (canvas: HTMLCanvasElement) => {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "canvas.png";
  a.click();
};

export const exportCanvasToSVG = (elements: Element[]) => {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800">`;
  svg += `<rect width="1000" height="800" fill="white"/>`;
  
  elements.forEach(el => {
    const x = el.width < 0 ? el.x + el.width : el.x;
    const y = el.height < 0 ? el.y + el.height : el.y;
    const w = Math.abs(el.width);
    const h = Math.abs(el.height);
    
    if (el.tool === "rect") {
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fillColor || 'none'}" stroke="${el.color}" stroke-width="${el.strokeWidth}" opacity="${el.opacity ?? 1}"/>`;
    } else if (el.tool === "circle") {
      svg += `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${el.fillColor || 'none'}" stroke="${el.color}" stroke-width="${el.strokeWidth}"/>`;
    } else if (el.tool === "line") {
      svg += `<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${el.color}" stroke-width="${el.strokeWidth}"/>`;
    } else if (el.tool === "arrow") {
      svg += `<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${el.color}" stroke-width="${el.strokeWidth}"/>`;
      const angle = Math.atan2(el.height, el.width);
      const hl = 15;
      svg += `<polygon points="${el.x + el.width},${el.y + el.height} ${el.x + el.width - hl * Math.cos(angle - Math.PI / 6)},${el.y + el.height - hl * Math.sin(angle - Math.PI / 6)} ${el.x + el.width - hl * Math.cos(angle + Math.PI / 6)},${el.y + el.height - hl * Math.sin(angle + Math.PI / 6)}" fill="${el.color}"/>`;
    } else if (el.tool === "text" && el.text) {
      svg += `<text x="${el.x}" y="${el.y + 20}" fill="${el.color}" font-size="16">${el.text}</text>`;
    }
  });
  
  svg += `</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "canvas.svg";
  a.click();
};

export const exportCanvasToPDF = (canvas: HTMLCanvasElement) => {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(`<img src="${canvas.toDataURL()}"/><script>window.print()</script>`);
  }
};
