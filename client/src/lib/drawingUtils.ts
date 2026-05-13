export const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, zoom: number) => {
  ctx.beginPath();
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 0.5;
  const size = 40 * zoom;
  for (let x = 0; x <= width; x += size) {
    ctx.moveTo(x, 0); ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += size) {
    ctx.moveTo(0, y); ctx.lineTo(width, y);
  }
  ctx.stroke();
};

export const drawDiamond = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); // Top
  ctx.lineTo(x + w, y + h / 2); // Right
  ctx.lineTo(x + w / 2, y + h); // Bottom
  ctx.lineTo(x, y + h / 2); // Left
  ctx.closePath();
};

export const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  const headLength = 15;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
};