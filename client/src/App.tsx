import React, { useState, useRef, useEffect, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { v4 as uuid } from "uuid";
import { Canvas } from "./components/Canvas";
import { ToolSidebar } from "./components/ToolSidebar";
import { TopBar } from "./components/TopBar";
import { IconLibrary } from "./components/IconLibrary";
import type { Element, Tool, Point, Guide, Comment } from "./lib/types";
import { screenToCanvas, isPointInElement, distanceToSegment } from "./lib/utils";

type Action = "none" | "drawing" | "moving" | "panning" | "erasing" | "resizing" | "connecting" | "commenting";

const RESIZE_HANDLE_SIZE = 8;
const EDGE_THRESHOLD = 10;
const PRESET_COLORS = ["#000000","#ffffff","#ff0000","#0000ff","#00ff00","#ffff00","#ffa500","#800080","#ffc0cb","#a52a2a","#808080","#00ffff"];

export const App = () => {
  const [elements, setElements] = useState<Element[]>([]);
  const [history, setHistory] = useState<Element[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [action, setAction] = useState<Action>("none");
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [isLibraryOpen, setLibraryOpen] = useState(false);

  // Drawing styles
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("#fff333");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(100);
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [arrowStyle, setArrowStyle] = useState<"default" | "filled" | "none">("default");
  const [eraserSize, setEraserSize] = useState(10);

  // Text editing
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingPosition, setEditingPosition] = useState<Point>({ x: 0, y: 0 });

  // Clipboard, rubber-band, grouping
  const clipboardRef = useRef<Element[]>([]);
  const [rubberBand, setRubberBand] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [nextGroupId, setNextGroupId] = useState(1);

  // Guides, comments, context menu
  const [guides, setGuides] = useState<Guide[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId?: string } | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Canvas background
const [bgTheme, setBgTheme] = useState<"white"|"light-grid"|"dark"|"dark-grid">("light-grid");
const [fullscreen, setFullscreen] = useState(false);

  // Minimap
  const [showMinimap, setShowMinimap] = useState(true);

  // Multiple boards
  const [boards, setBoards] = useState<{ id: string; name: string; elements: Element[] }[]>([
    { id: "board-1", name: "Board 1", elements: [] }
  ]);
  const [activeBoardId, setActiveBoardId] = useState("board-1");
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const socketRef = useRef<Socket | null>(null);
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

  // Auto-save
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentId = useRef<string | null>(null);
  const offset = useRef<Point>({ x: 0, y: 0 });
  const resizeOrigin = useRef<{ x: number; y: number; el: Element } | null>(null);
  const connectionOrigin = useRef<{ elementId: string; point: Point } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getSelectedElements = (): Element[] => elements.filter(el => el.isSelected);
  const getSelected = () => elements.find(el => el.isSelected);

  // Sync elements with active board
  useEffect(() => { setElements(boards.find(b => b.id === activeBoardId)?.elements || []); }, [activeBoardId]);
  const activeBoardIdRef = useRef(activeBoardId);
  useEffect(() => { activeBoardIdRef.current = activeBoardId; }, [activeBoardId]);

  const syncBoard = useCallback((els: Element[]) => {
    setBoards(prev => prev.map(b => b.id === activeBoardIdRef.current ? { ...b, elements: els } : b));
  }, []);

  const sendBoardState = useCallback((currentElements: Element[]) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("board-state", currentElements.map(el => ({ ...el, lastModified: Date.now() })));
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("presence", ({ count }: { count: number }) => setPeerCount(count));

    socket.on("init-state", (serverElements: Element[]) => {
      setElements(serverElements);
      syncBoard(serverElements);
      setHistory([serverElements]);
      setHistoryIndex(0);
    });

    socket.on("element-created", (newElement: Element) => {
      setElements(prev => {
        const next = [...prev, newElement];
        syncBoard(next);
        return next;
      });
    });

    socket.on("element-updated", (updatedElement: Element) => {
      setElements(prev => {
        const next = prev.map(el => el.id === updatedElement.id ? updatedElement : el);
        syncBoard(next);
        return next;
      });
    });

    socket.on("element-deleted", (elementId: string) => {
      setElements(prev => {
        const next = prev.filter(el => el.id !== elementId);
        syncBoard(next);
        return next;
      });
    });

    socket.on("board-state", (serverElements: Element[]) => {
      setElements(serverElements);
      syncBoard(serverElements);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [SOCKET_URL, syncBoard]);

  const pushToHistory = (newElements: Element[]) => {
    syncBoard(newElements);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(newElements);
    sendBoardState(newElements);
  };

  // Improvement 29: Auto-save
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      localStorage.setItem("whiteboard-autosave", JSON.stringify({ elements, boards, activeBoardId }));
    }, 5000);
    // Restore on load
    const saved = localStorage.getItem("whiteboard-autosave");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.boards) setBoards(data.boards);
        if (data.activeBoardId) setActiveBoardId(data.activeBoardId);
        if (data.elements) setElements(data.elements);
      } catch {}
    }
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, []);

  // Improvement 23: Fullscreen
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const getElementBounds = (el: Element) => {
    if (el.tool === "pen" && el.points && el.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      el.points.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      });
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    return { x: el.width < 0 ? el.x + el.width : el.x, y: el.height < 0 ? el.y + el.height : el.y, width: Math.abs(el.width), height: Math.abs(el.height) };
  };

  const isPointNearEdge = (px: number, py: number, bounds: { x: number; y: number; width: number; height: number }) => {
    const { x, y, width, height } = bounds;
    const inside = px >= x - EDGE_THRESHOLD && px <= x + width + EDGE_THRESHOLD && py >= y - EDGE_THRESHOLD && py <= y + height + EDGE_THRESHOLD;
    const deepInside = px >= x + EDGE_THRESHOLD && px <= x + width - EDGE_THRESHOLD && py >= y + EDGE_THRESHOLD && py <= y + height - EDGE_THRESHOLD;
    return inside && !deepInside;
  };

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (presentationMode) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const direction = e.deltaY > 0 ? -1 : 1, step = 0.05;
      setZoom(prev => Math.min(Math.max(prev * (1 + direction * step), 0.1), 5));
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [presentationMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (presentationMode) {
        if (e.key === "ArrowRight" || e.key === " ") {
          setPresentationIndex(i => Math.min(i + 1, elements.length));
        } else if (e.key === "ArrowLeft") {
          setPresentationIndex(i => Math.max(i - 1, 0));
        } else if (e.key === "Escape") {
          setPresentationMode(false);
          document.exitFullscreen();
        }
        return;
      }
      if (ctrl && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        const sel = elements.filter(el => el.isSelected && !el.locked);
        if (sel.length > 0) pushToHistory(elements.filter(el => !el.isSelected || el.locked));
      }
      else if (ctrl && e.key === "c") { e.preventDefault(); clipboardRef.current = elements.filter(el => el.isSelected).map(el => ({ ...el, isSelected: false })); }
      else if (ctrl && e.key === "x") { e.preventDefault(); clipboardRef.current = elements.filter(el => el.isSelected && !el.locked).map(el => ({ ...el, isSelected: false })); pushToHistory(elements.filter(el => !el.isSelected || el.locked)); }
      else if (ctrl && e.key === "d") { e.preventDefault(); duplicateSelected(); }
      else if (ctrl && e.key === "v") { e.preventDefault(); pasteElements(); }
      else if (ctrl && e.key === "a") { e.preventDefault(); setElements(elements.map(el => ({ ...el, isSelected: !el.locked }))); }
      else if (ctrl && e.key === "g" && !e.shiftKey) { e.preventDefault(); groupSelected(); }
      else if (ctrl && e.key === "g" && e.shiftKey) { e.preventDefault(); ungroupSelected(); }
      else if (ctrl && e.key === "0") { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); }
      // Z-order shortcuts
      else if (ctrl && e.key === "]" && e.shiftKey) { e.preventDefault(); bringToFront(); }
      else if (ctrl && e.key === "[" && e.shiftKey) { e.preventDefault(); sendToBack(); }
      else if (ctrl && e.key === "]") { e.preventDefault(); bringForward(); }
      else if (ctrl && e.key === "[") { e.preventDefault(); sendBackward(); }
      // Alignment
      else if (ctrl && e.key === "ArrowLeft") { e.preventDefault(); alignSelected("left"); }
      else if (ctrl && e.key === "ArrowRight") { e.preventDefault(); alignSelected("right"); }
      else if (ctrl && e.key === "ArrowUp") { e.preventDefault(); alignSelected("top"); }
      else if (ctrl && e.key === "ArrowDown") { e.preventDefault(); alignSelected("bottom"); }
      else if (ctrl && e.key === "e") { e.preventDefault(); exportCanvas(); }
      else if (ctrl && e.key === "s") { e.preventDefault(); /* SVG export via TopBar */ }
      // Tool shortcuts
      else {
        const keyMap: Record<string, Tool> = { "v": "select", "h": "hand", "p": "pen", "r": "rect", "c": "circle", "l": "line", "a": "arrow", "t": "text", "e": "eraser", "i": "icon" };
        const tool = keyMap[e.key.toLowerCase()];
        if (tool) setSelectedTool(tool);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [elements, historyIndex, presentationMode]);

  // Improvement 11: Z-order
  const bringToFront = () => {
    const sel = elements.filter(el => el.isSelected);
    if (sel.length === 0) return;
    const others = elements.filter(el => !el.isSelected);
    pushToHistory([...others, ...sel]);
  };
  const sendToBack = () => {
    const sel = elements.filter(el => el.isSelected);
    if (sel.length === 0) return;
    const others = elements.filter(el => !el.isSelected);
    pushToHistory([...sel, ...others]);
  };
  const bringForward = () => {
    const idx = elements.findIndex(el => el.isSelected);
    if (idx < 0 || idx >= elements.length - 1) return;
    const arr = [...elements];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    pushToHistory(arr);
  };
  const sendBackward = () => {
    const idx = elements.findIndex(el => el.isSelected);
    if (idx <= 0) return;
    const arr = [...elements];
    [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
    pushToHistory(arr);
  };

  // Improvement 12: Lock/unlock
  const toggleLock = () => {
    pushToHistory(elements.map(el => el.isSelected ? { ...el, locked: !el.locked } : el));
  };

  // Improvement 14: Add guide
  const addGuide = (type: "horizontal" | "vertical", position: number) => {
    setGuides(prev => [...prev, { id: uuid(), type, position }]);
  };

  // Improvement 6 helpers
  const duplicateSelected = () => {
    const sel = elements.filter(el => el.isSelected && !el.locked);
    if (sel.length === 0) return;
    const dupes = sel.map(el => ({ ...el, id: uuid(), x: el.x + 20, y: el.y + 20, isSelected: false }));
    pushToHistory([...elements, ...dupes]);
  };
  const pasteElements = () => {
    if (clipboardRef.current.length === 0) return;
    const pasted = clipboardRef.current.map(el => ({ ...el, id: uuid(), x: el.x + 20, y: el.y + 20, isSelected: true }));
    const deselected = elements.map(el => ({ ...el, isSelected: false }));
    pushToHistory([...deselected, ...pasted]);
  };

  // Improvement 9: Alignment
  const alignSelected = (dir: "left"|"center"|"right"|"top"|"middle"|"bottom"|"distribute-h"|"distribute-v") => {
    const sel = elements.filter(el => el.isSelected);
    if (sel.length < 2) return;
    pushToHistory(elements.map(el => {
      if (!el.isSelected) return el;
      const b = getElementBounds(el);
      const allBounds = sel.map(s => getElementBounds(s));
      const minX = Math.min(...allBounds.map(b => b.x)), maxX = Math.max(...allBounds.map(b => b.x + b.width));
      const minY = Math.min(...allBounds.map(b => b.y)), maxY = Math.max(...allBounds.map(b => b.y + b.height));
      const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
      let dx = 0, dy = 0;
      switch (dir) {
        case "left": dx = minX - b.x; break;
        case "center": dx = cx - (b.x + b.width/2); break;
        case "right": dx = maxX - (b.x + b.width); break;
        case "top": dy = minY - b.y; break;
        case "middle": dy = cy - (b.y + b.height/2); break;
        case "bottom": dy = maxY - (b.y + b.height); break;
        case "distribute-h": {
          const sorted = [...sel].sort((a,b) => getElementBounds(a).x - getElementBounds(b).x);
          const idx = sorted.findIndex(s => s.id === el.id);
          if (idx > 0 && idx < sorted.length-1) { const sp = (maxX-minX)/(sorted.length-1); dx = (minX + sp*idx) - b.x; }
          break;
        }
        case "distribute-v": {
          const sorted = [...sel].sort((a,b) => getElementBounds(a).y - getElementBounds(b).y);
          const idx = sorted.findIndex(s => s.id === el.id);
          if (idx > 0 && idx < sorted.length-1) { const sp = (maxY-minY)/(sorted.length-1); dy = (minY + sp*idx) - b.y; }
          break;
        }
      }
      return { ...el, x: el.x + dx, y: el.y + dy };
    }));
  };

  // Improvement 10: Group
  const groupSelected = () => {
    const sel = elements.filter(el => el.isSelected);
    if (sel.length < 2) return;
    const gid = `group-${nextGroupId}`; setNextGroupId(prev => prev+1);
    pushToHistory(elements.map(el => el.isSelected ? { ...el, groupId: gid, isSelected: false } : el));
  };
  const ungroupSelected = () => {
    const sel = elements.filter(el => el.isSelected);
    if (sel.length === 0) return;
    const gids = new Set(sel.map(el => el.groupId).filter(Boolean));
    if (gids.size === 0) return;
    pushToHistory(elements.map(el => (el.groupId && gids.has(el.groupId)) ? { ...el, groupId: undefined } : el));
  };

  // Text editing
  const handleTextBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!editingElementId) return;
    pushToHistory(elements.map(el => el.id === editingElementId ? { ...el, text: editingText, width: Math.max(e.target.scrollWidth,30), height: Math.max(e.target.scrollHeight,20) } : el));
    setEditingElementId(null); setEditingText("");
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (editingElementId) setEditingElementId(null);
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    if (selectedTool === "hand") { setAction("panning"); return; }
    if (selectedTool === "eraser") { setAction("erasing"); return; }
    if (selectedTool === "eyedropper") {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const p = ctx.getImageData(e.clientX, e.clientY, 1, 1).data;
        setStrokeColor(`#${p[0].toString(16).padStart(2,'0')}${p[1].toString(16).padStart(2,'0')}${p[2].toString(16).padStart(2,'0')}`);
      }
      return;
    }
    if (selectedTool === "text") {
      const id = uuid(); currentId.current = id;
      setElements([...elements, { id, tool: "text", x: point.x, y: point.y, width: 1, height: 1, color: strokeColor, strokeWidth: 1, fillColor: "transparent", opacity: opacity/100, text: "" }]);
      setEditingElementId(id); setEditingText(""); setEditingPosition({ x: point.x, y: point.y });
      return;
    }
    if (selectedTool === "sticky") {
      const id = uuid();
      pushToHistory([...elements, { id, tool: "rect", x: point.x, y: point.y, width: 120, height: 100, color: "#000", fillColor: "#FFD700", strokeWidth: 1, opacity: opacity/100, text: "Sticky note", rotation: Math.random() * 4 - 2 }]);
      return;
    }
    if (selectedTool === "icon") { setLibraryOpen(true); return; }

    if (selectedTool === "select") {
      const selectedEl = elements.find(el => el.isSelected && !el.locked);
      if (selectedEl) {
        const bounds = getElementBounds(selectedEl);
        if (isPointNearEdge(point.x, point.y, bounds)) {
          const newId = uuid(); connectionOrigin.current = { elementId: selectedEl.id, point }; currentId.current = newId;
          setElements([...elements, { id: newId, tool: "line", x: point.x, y: point.y, width: 0, height: 0, color: strokeColor, strokeWidth, opacity: opacity/100, boundElementIds: { start: selectedEl.id, end: null } }]);
          setAction("connecting"); return;
        }
        const corners = [{ x: bounds.x, y: bounds.y }, { x: bounds.x+bounds.width, y: bounds.y }, { x: bounds.x+bounds.width, y: bounds.y+bounds.height }, { x: bounds.x, y: bounds.y+bounds.height }];
        for (const c of corners) { if (Math.hypot(point.x-c.x, point.y-c.y) < RESIZE_HANDLE_SIZE/zoom) { setAction("resizing"); currentId.current = selectedEl.id; resizeOrigin.current = { x: point.x, y: point.y, el: selectedEl }; return; } }
      }
      const clicked = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
      if (clicked) {
        const shift = e.shiftKey;
        setElements(elements.map(el => el.id === clicked.id ? { ...el, isSelected: shift ? !el.isSelected : true } : shift ? el : { ...el, isSelected: false }));
        currentId.current = clicked.id; offset.current = { x: point.x - clicked.x, y: point.y - clicked.y }; setAction("moving");
      } else {
        if (!e.shiftKey) setElements(elements.map(el => ({ ...el, isSelected: false })));
        setRubberBand({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      }
      return;
    }

      // Drawing
      const id = uuid(); currentId.current = id;
      const isPenLike = ["pen", "highlighter"].includes(selectedTool);
      const el: Element = {
        id, tool: selectedTool, x: point.x, y: point.y, width: 0, height: 0,
        color: selectedTool === "highlighter" ? "#FFEB3B" : strokeColor,
        fillColor: ["pen","line","arrow","highlighter"].includes(selectedTool) ? undefined : fillColor,
        strokeWidth: selectedTool === "highlighter" ? 20 : strokeWidth,
        opacity: selectedTool === "highlighter" ? 0.3 : opacity/100,
        points: isPenLike ? [point] : undefined,
        lineStyle: selectedTool === "highlighter" ? undefined : lineStyle,
        arrowStyle: selectedTool === "arrow" ? arrowStyle : undefined,
      };
      setElements([...elements, el]); setAction("drawing");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    if (action === "panning") { setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY })); }
    else if (action === "drawing") {
      setElements(prev => prev.map(el => {
        if (el.id !== currentId.current) return el;
        if (el.tool === "pen") return { ...el, points: [...(el.points || []), point] };
        return { ...el, width: point.x - el.x, height: point.y - el.y };
      }));
    } else if (action === "moving") {
      setElements(prev => prev.map(el => {
        if (!el.isSelected || el.locked) return el;
        if (el.id === currentId.current) return { ...el, x: point.x - offset.current.x, y: point.y - offset.current.y };
        const ddx = point.x - offset.current.x - (prev.find(p => p.id === currentId.current)?.x ?? 0);
        const ddy = point.y - offset.current.y - (prev.find(p => p.id === currentId.current)?.y ?? 0);
        return { ...el, x: el.x + ddx, y: el.y + ddy };
      }));
    } else if (action === "erasing") {
      setElements(prev => prev.filter(el => {
        if (el.tool === "pen" && el.points) { for (let i=0; i<el.points.length-1; i++) if (distanceToSegment(point.x, point.y, el.points[i].x, el.points[i].y, el.points[i+1].x, el.points[i+1].y) < eraserSize) return false; return true; }
        return !isPointInElement(point.x, point.y, el);
      }));
    } else if (action === "resizing" && currentId.current && resizeOrigin.current) {
      setElements(prev => prev.map(el => {
        if (el.id !== currentId.current) return el;
        let w = resizeOrigin.current!.el.width + (point.x - resizeOrigin.current!.x);
        let h = resizeOrigin.current!.el.height + (point.y - resizeOrigin.current!.y);
        return { ...el, width: w, height: h };
      }));
    } else if (action === "connecting" && currentId.current) {
      const hovered = [...elements].reverse().find(el => el.id !== currentId.current && el.id !== connectionOrigin.current?.elementId && isPointInElement(point.x, point.y, el));
      setElements(prev => prev.map(el => {
        if (el.id !== currentId.current) return el;
        const bounds = hovered ? getElementBounds(hovered) : null;
        const tp = bounds ? { x: bounds.x+bounds.width/2, y: bounds.y+bounds.height/2 } : point;
        return { ...el, width: tp.x - el.x, height: tp.y - el.y, boundElementIds: { ...el.boundElementIds, end: hovered ? hovered.id : null } };
      }));
    }
    if (rubberBand) setRubberBand(prev => prev ? { ...prev, x2: point.x, y2: point.y } : null);
  };

  const finishRubberBand = useCallback(() => {
    if (!rubberBand) return;
    const x1=Math.min(rubberBand.x1, rubberBand.x2), y1=Math.min(rubberBand.y1, rubberBand.y2), x2=Math.max(rubberBand.x1, rubberBand.x2), y2=Math.max(rubberBand.y1, rubberBand.y2);
    setElements(prev => prev.map(el => { const b=getElementBounds(el); return { ...el, isSelected: (b.x+b.width>=x1 && b.x<=x2 && b.y+b.height>=y1 && b.y<=y2) || el.isSelected }; }));
    setRubberBand(null);
  }, [rubberBand]);

  const handleMouseUp = () => {
    if (["drawing","moving","resizing","connecting","erasing"].includes(action)) {
      pushToHistory(elements);
    }
    if (rubberBand) finishRubberBand();
    setAction("none"); currentId.current = null; resizeOrigin.current = null; connectionOrigin.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (selectedTool !== "select") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    const clicked = [...elements].reverse().find(el => ["text","rect","line","arrow","sticky"].includes(el.tool) && el.tool as string && isPointInElement(point.x, point.y, el));
    if (clicked) {
      setEditingElementId(clicked.id); setEditingText(clicked.text || ""); setEditingPosition({ x: clicked.x, y: clicked.y });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    const clicked = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
    setContextMenu({ x: e.clientX, y: e.clientY, elementId: clicked?.id });
  };

  // Touch support (improvement 24)
  const touchStartRef = useRef<{ x:number; y:number; time:number; dist:number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now(), dist: 0 };
      const me = new MouseEvent("mousedown", { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      canvasRef.current?.dispatchEvent(me);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      const me = new MouseEvent("mousemove", { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, movementX: e.touches[0].clientX - touchStartRef.current.x, movementY: e.touches[0].clientY - touchStartRef.current.y });
      canvasRef.current?.dispatchEvent(me);
      touchStartRef.current.x = e.touches[0].clientX; touchStartRef.current.y = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (touchStartRef.current?.dist) { const delta = dist - touchStartRef.current.dist; if (Math.abs(delta) > 5) setZoom(z => Math.max(0.1, Math.min(5, z + delta * 0.005))); }
      touchStartRef.current = { ...touchStartRef.current!, dist };
    }
  };
  const handleTouchEnd = () => {
    const me = new MouseEvent("mouseup", {});
    canvasRef.current?.dispatchEvent(me);
    if (touchStartRef.current && Date.now() - touchStartRef.current.time > 500) {
      // Long press -> context menu
      handleContextMenu(new MouseEvent("contextmenu", { clientX: touchStartRef.current.x, clientY: touchStartRef.current.y }) as unknown as React.MouseEvent);
    }
    touchStartRef.current = null;
  };

  const undo = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex-1); setElements(history[historyIndex-1]); } };
  const redo = () => { if (historyIndex < history.length-1) { setHistoryIndex(historyIndex+1); setElements(history[historyIndex+1]); } };
  const clearCanvas = () => pushToHistory([]);

  const exportCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a"); a.href = url; a.download = "canvas.png"; a.click();
  };

  // Improvement 27: SVG Export
  const exportSVG = () => {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800">`;
    svg += `<rect width="1000" height="800" fill="white"/>`;
    elements.forEach(el => {
      const x = el.width < 0 ? el.x+el.width : el.x;
      const y = el.height < 0 ? el.y+el.height : el.y;
      const w = Math.abs(el.width), h = Math.abs(el.height);
      if (el.tool === "rect") svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fillColor||'none'}" stroke="${el.color}" stroke-width="${el.strokeWidth}" opacity="${el.opacity??1}"/>`;
      else if (el.tool === "circle") svg += `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${el.fillColor||'none'}" stroke="${el.color}" stroke-width="${el.strokeWidth}"/>`;
      else if (el.tool === "line") svg += `<line x1="${el.x}" y1="${el.y}" x2="${el.x+el.width}" y2="${el.y+el.height}" stroke="${el.color}" stroke-width="${el.strokeWidth}"/>`;
      else if (el.tool === "arrow") {
        svg += `<line x1="${el.x}" y1="${el.y}" x2="${el.x+el.width}" y2="${el.y+el.height}" stroke="${el.color}" stroke-width="${el.strokeWidth}"/>`;
        const angle = Math.atan2(el.height, el.width), hl = 15;
        svg += `<polygon points="${el.x+el.width},${el.y+el.height} ${el.x+el.width-hl*Math.cos(angle-Math.PI/6)},${el.y+el.height-hl*Math.sin(angle-Math.PI/6)} ${el.x+el.width-hl*Math.cos(angle+Math.PI/6)},${el.y+el.height-hl*Math.sin(angle+Math.PI/6)}" fill="${el.color}"/>`;
      }
      else if (el.tool === "text" && el.text) svg += `<text x="${el.x}" y="${el.y+20}" fill="${el.color}" font-size="16">${el.text}</text>`;
    });
    svg += `</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "canvas.svg"; a.click();
  };

  // Improvement 28: PDF Export
  const exportPDF = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const win = window.open("", "_blank");
    if (win) { win.document.write(`<img src="${canvas.toDataURL()}"/><script>window.print()</script>`); }
  };

  // Improvement 26: Import image
  const handleImportImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = uuid();
      pushToHistory([...elements, { id, tool: "rect", x: 100, y: 100, width: 200, height: 150, color: "#000", strokeWidth: 0, imageData: reader.result as string }]);
    };
    reader.readAsDataURL(file);
  };

  // Improvement 21: Zoom to fit
  const zoomToFit = () => {
    if (elements.length === 0) return;
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    elements.forEach(el => { const b=getElementBounds(el); minX=Math.min(minX,b.x); minY=Math.min(minY,b.y); maxX=Math.max(maxX,b.x+b.width); maxY=Math.max(maxY,b.y+b.height); });
    const padding = 50;
    const fitZoom = Math.min((window.innerWidth-padding*2)/(maxX-minX), (window.innerHeight-padding*2)/(maxY-minY), 2);
    setZoom(fitZoom); setPan({ x: -minX*fitZoom + padding, y: -minY*fitZoom + padding });
  };

  // Improvement 35: Toggle label edit
  const setLabel = useCallback((elId: string, text: string) => {
    pushToHistory(elements.map(el => el.id === elId ? { ...el, label: { text, offsetX: 0, offsetY: -20 } } : el));
  }, [elements]);

  // Templates
  const templates: Record<string, Element[]> = {
    "Blank": [],
    "Wireframe": [
      { id:"1", tool:"rect", x:50, y:50, width:300, height:400, color:"#333", fillColor:"#e5e7eb", strokeWidth:1 },
      { id:"2", tool:"rect", x:400, y:50, width:200, height:200, color:"#333", fillColor:"#bfdbfe", strokeWidth:1 },
      { id:"3", tool:"rect", x:400, y:270, width:200, height:180, color:"#333", fillColor:"#bbf7d0", strokeWidth:1 },
      { id:"4", tool:"text", x:60, y:60, width:280, height:30, color:"#000", strokeWidth:0, text:"Header" },
      { id:"5", tool:"text", x:410, y:60, width:180, height:30, color:"#000", strokeWidth:0, text:"Sidebar" },
    ],
    "Mindmap": [
      { id:"1", tool:"circle", x:350, y:200, width:100, height:80, color:"#2563eb", fillColor:"#dbeafe", strokeWidth:2, text:"Idea" },
      { id:"2", tool:"line", x:450, y:240, width:50, height:-80, color:"#999", strokeWidth:2 },
      { id:"3", tool:"rect", x:500, y:120, width:100, height:60, color:"#333", fillColor:"#fef08a", strokeWidth:1, text:"Branch 1" },
      { id:"4", tool:"line", x:450, y:240, width:50, height:80, color:"#999", strokeWidth:2 },
      { id:"5", tool:"rect", x:500, y:300, width:100, height:60, color:"#333", fillColor:"#bbf7d0", strokeWidth:1, text:"Branch 2" },
    ],
    "Kanban": [
      { id:"1", tool:"rect", x:30, y:40, width:300, height:500, color:"#333", fillColor:"#f3f4f6", strokeWidth:1 },
      { id:"2", tool:"rect", x:360, y:40, width:300, height:500, color:"#333", fillColor:"#f3f4f6", strokeWidth:1 },
      { id:"3", tool:"rect", x:690, y:40, width:300, height:500, color:"#333", fillColor:"#f3f4f6", strokeWidth:1 },
      { id:"4", tool:"text", x:120, y:50, width:100, height:30, color:"#000", strokeWidth:0, text:"To Do" },
      { id:"5", tool:"text", x:450, y:50, width:100, height:30, color:"#000", strokeWidth:0, text:"In Progress" },
      { id:"6", tool:"text", x:780, y:50, width:100, height:30, color:"#000", strokeWidth:0, text:"Done" },
    ],
    "SWOT Analysis": [
      { id:"1", tool:"text", x:200, y:30, width:100, height:30, color:"#000", strokeWidth:0, text:"SWOT" },
      { id:"2", tool:"rect", x:30, y:70, width:400, height:200, color:"#333", fillColor:"#dcfce7", strokeWidth:1 },
      { id:"3", tool:"rect", x:450, y:70, width:400, height:200, color:"#333", fillColor:"#fef08a", strokeWidth:1 },
      { id:"4", tool:"rect", x:30, y:290, width:400, height:200, color:"#333", fillColor:"#dbeafe", strokeWidth:1 },
      { id:"5", tool:"rect", x:450, y:290, width:400, height:200, color:"#333", fillColor:"#fecaca", strokeWidth:1 },
      { id:"6", tool:"text", x:180, y:80, width:100, height:30, color:"#000", strokeWidth:0, text:"Strengths" },
      { id:"7", tool:"text", x:620, y:80, width:100, height:30, color:"#000", strokeWidth:0, text:"Weaknesses" },
      { id:"8", tool:"text", x:180, y:300, width:100, height:30, color:"#000", strokeWidth:0, text:"Opportunities" },
      { id:"9", tool:"text", x:620, y:300, width:100, height:30, color:"#000", strokeWidth:0, text:"Threats" },
    ],
  };

  const loadTemplate = (name: string) => {
    const tmpl = templates[name];
    if (tmpl) pushToHistory(tmpl.map(el => ({ ...el, id: uuid(), isSelected: false })));
    setTemplatesOpen(false);
  };

  const getCursor = () => {
    if (selectedTool === "hand" || action === "panning") return "grab";
    if (selectedTool === "eraser") return "crosshair";
    if (selectedTool === "text") return "text";
    if (action === "moving") return "move";
    if (action === "resizing") return "nwse-resize";
    return "crosshair";
  };

  const selCount = getSelectedElements().length;

  if (presentationMode) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center" onClick={() => setPresentationIndex(i => Math.min(i+1, elements.length))}>
        <div className="text-white text-center">
          <Canvas ref={canvasRef} elements={elements.slice(0, presentationIndex+1)} pan={{x:0,y:0}} zoom={1} showGrid={false} rubberBand={null}
            onMouseDown={()=>{}} onMouseMove={()=>{}} onMouseUp={()=>{}} onDoubleClick={()=>{}} cursor="pointer" />
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-gray-400 text-sm">
            {presentationIndex+1} / {elements.length+1} · Click or → to advance · Esc to exit
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-50 overflow-hidden relative select-none" style={{ touchAction: "none" }}>
      {/* Improvement 43: Board tabs */}
      <div className="fixed top-0 left-0 right-0 h-8 bg-gray-100 flex items-center gap-1 px-4 z-50 overflow-x-auto">
        {boards.map(board => (
          <button key={board.id} onClick={() => { pushToHistory(elements); setActiveBoardId(board.id); }}
            className={`px-3 py-0.5 text-xs rounded-t ${board.id === activeBoardId ? "bg-white font-semibold" : "hover:bg-gray-200"}`}>
            {board.name}
          </button>
        ))}
        <button onClick={() => { const id = uuid(); setBoards([...boards, { id, name: `Board ${boards.length+1}`, elements: [] }]); setActiveBoardId(id); }}
          className="px-2 text-xs hover:bg-gray-200 rounded">+</button>
      </div>

      <TopBar onUndo={undo} onRedo={redo} onClear={clearCanvas} onExport={exportCanvas} canUndo={historyIndex>0} canRedo={historyIndex<history.length-1}
        onAlignLeft={()=>alignSelected("left")} onAlignCenter={()=>alignSelected("center")} onAlignRight={()=>alignSelected("right")}
        onAlignTop={()=>alignSelected("top")} onAlignMiddle={()=>alignSelected("middle")} onAlignBottom={()=>alignSelected("bottom")}
        onDistributeH={()=>alignSelected("distribute-h")} onDistributeV={()=>alignSelected("distribute-v")}
        onGroup={groupSelected} onUngroup={ungroupSelected}
        onBringToFront={bringToFront} onSendToBack={sendToBack} onBringForward={bringForward} onSendBackward={sendBackward}
        onToggleLock={toggleLock}
        onExportSVG={exportSVG} onExportPDF={exportPDF}
        hasSelection={selCount>0} hasMultiSelection={selCount>1}
        onImportImage={handleImportImage}
        onZoomToFit={zoomToFit} onFullscreen={() => document.documentElement.requestFullscreen()}
        onToggleComments={()=>setCommentsPanelOpen(!commentsPanelOpen)}
        onToggleLayers={()=>setLayersPanelOpen(!layersPanelOpen)}
        onToggleProperties={()=>setPropertiesPanelOpen(!propertiesPanelOpen)}
        onToggleTemplates={()=>setTemplatesOpen(!templatesOpen)}
        onPresentation={()=>{ setPresentationMode(true); setPresentationIndex(-1); document.documentElement.requestFullscreen(); }}
        historyIndex={historyIndex} historyLength={history.length}
      />

      <div className="fixed left-4 top-20 z-40 rounded-2xl border bg-white/95 px-4 py-2 text-xs shadow-lg backdrop-blur-md">
        <div className="font-semibold">Realtime status</div>
        <div className="mt-1">Connected: <span className={`font-bold ${socketConnected ? 'text-green-700' : 'text-red-700'}`}>{socketConnected ? 'Yes' : 'No'}</span></div>
        <div>Peers: <span className="font-semibold">{peerCount}</span></div>
        <div className="text-gray-500">Server: {SOCKET_URL}</div>
      </div>

      <ToolSidebar selectedTool={selectedTool} setSelectedTool={setSelectedTool}
        strokeColor={strokeColor} fillColor={fillColor} onStrokeColorChange={c=>{ setStrokeColor(c); setRecentColors(prev=>[...new Set([c,...prev])].slice(0,5)); }} onFillColorChange={setFillColor}
        strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
        opacity={opacity} onOpacityChange={setOpacity}
        lineStyle={lineStyle} onLineStyleChange={setLineStyle}
        arrowStyle={arrowStyle} onArrowStyleChange={setArrowStyle}
        eraserSize={eraserSize} onEraserSizeChange={setEraserSize}
        presetColors={PRESET_COLORS} recentColors={recentColors}
        onOpenLibrary={()=>setLibraryOpen(!isLibraryOpen)}
        onAddGuide={addGuide} canvasRef={canvasRef} pan={pan} zoom={zoom}
      />

      {/* Properties panel (Improvement 32) */}
      {propertiesPanelOpen && getSelected() && (
        <div className="fixed right-4 top-20 bg-white shadow-xl rounded-2xl border p-4 z-50 w-56">
          <h3 className="font-bold text-sm mb-3">Properties</h3>
          {(() => { const el = getSelected(); if (!el) return null; return (
            <div className="space-y-2 text-xs">
              <div>Type: <span className="font-mono">{el.tool}</span></div>
              <div className="flex gap-2"><span>X:</span><input type="number" value={Math.round(el.x)} onChange={e => pushToHistory(elements.map(ee => ee.id===el.id?{...ee,x:Number(e.target.value)}:ee))} className="w-16 border rounded px-1"/></div>
              <div className="flex gap-2"><span>Y:</span><input type="number" value={Math.round(el.y)} onChange={e => pushToHistory(elements.map(ee => ee.id===el.id?{...ee,y:Number(e.target.value)}:ee))} className="w-16 border rounded px-1"/></div>
              <div className="flex gap-2"><span>W:</span><input type="number" value={Math.round(el.width)} onChange={e => pushToHistory(elements.map(ee => ee.id===el.id?{...ee,width:Number(e.target.value)}:ee))} className="w-16 border rounded px-1"/></div>
              <div className="flex gap-2"><span>H:</span><input type="number" value={Math.round(el.height)} onChange={e => pushToHistory(elements.map(ee => ee.id===el.id?{...ee,height:Number(e.target.value)}:ee))} className="w-16 border rounded px-1"/></div>
              <div><label>Color</label><input type="color" value={el.color} onChange={e => pushToHistory(elements.map(ee => ee.id===el.id?{...ee,color:e.target.value}:ee))} className="w-full"/></div>
              <div><label>Opacity ({Math.round((el.opacity??1)*100)}%)</label><input type="range" min={0} max={100} value={(el.opacity??1)*100} onChange={e => pushToHistory(elements.map(ee => ee.id===el.id?{...ee,opacity:Number(e.target.value)/100}:ee))} className="w-full"/></div>
            </div>
          ); })()}
        </div>
      )}

      {/* Layers panel (Improvement 41) */}
      {layersPanelOpen && (
        <div className="fixed right-4 top-20 bg-white shadow-xl rounded-2xl border p-4 z-50 w-56 max-h-96 overflow-y-auto">
          <h3 className="font-bold text-sm mb-3">Layers</h3>
          {[...elements].reverse().map((el, i) => (
            <div key={el.id} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${el.isSelected?"bg-blue-100":"hover:bg-gray-50"}`}
              onClick={() => setElements(elements.map(ee => ({ ...ee, isSelected: ee.id === el.id })))}>
              <span className="text-gray-400 w-4">{elements.length - i}</span>
              <span className="flex-1 truncate">{el.tool}{el.text?`: ${el.text.slice(0,15)}`:""}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleLock(); }} className="text-gray-400 hover:text-gray-700">{el.locked ? "🔒" : "🔓"}</button>
              <button onClick={(e) => { e.stopPropagation(); pushToHistory(elements.filter(ee => ee.id !== el.id)); }} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Comments panel (Improvement 40) */}
      {commentsPanelOpen && (
        <div className="fixed right-4 top-20 bg-white shadow-xl rounded-2xl border p-4 z-50 w-64 max-h-96 overflow-y-auto">
          <h3 className="font-bold text-sm mb-3">Comments</h3>
          {comments.filter(c => !c.resolved).map(c => (
            <div key={c.id} className="text-xs border-b pb-2 mb-2">
              <div className="text-gray-500">{new Date(c.timestamp).toLocaleString()}</div>
              <div className="my-1">{c.text}</div>
              <button onClick={() => setComments(comments.map(cc => cc.id===c.id?{...cc,resolved:true}:cc))} className="text-green-600">✓ Resolve</button>
            </div>
          ))}
          {comments.filter(c => !c.resolved).length === 0 && <div className="text-xs text-gray-400">No comments. Use Select tool, right-click to add.</div>}
        </div>
      )}

      {/* Templates modal (Improvement 42) */}
      {templatesOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={()=>setTemplatesOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-4">Templates</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(templates).map(name => (
                <button key={name} onClick={()=>loadTemplate(name)} className="p-4 border rounded-xl hover:bg-blue-50 hover:border-blue-200 text-sm font-medium">
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLibraryOpen && (
        <IconLibrary onSelect={(icon) => {
          const id = uuid();
          pushToHistory([...elements, { id, tool: "icon", x: 100, y: 100, width: 50, height: 50, color: icon.color, fillColor: icon.color, strokeWidth: 0, opacity: opacity/100, icon: icon.name, iconName: icon.name, iconColor: icon.color, svgPaths: icon.svgPaths, viewBox: icon.viewBox }]);
          setLibraryOpen(false);
        }} onClose={() => setLibraryOpen(false)} />
      )}

      {/* Zoom controls + minimap + extra buttons */}
      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-xl border bg-white p-3 shadow-lg">
        <button onClick={() => setZoom(z => Math.min(z*1.1,4))} className="rounded px-2 py-1 hover:bg-gray-100 text-sm font-bold">+</button>
        <span className="font-mono text-xs w-12 text-center">{Math.round(zoom*100)}%</span>
        <button onClick={() => setZoom(z => Math.max(z/1.1,0.1))} className="rounded px-2 py-1 hover:bg-gray-100 text-sm font-bold">−</button>
        <div className="w-px h-4 bg-gray-200"/>
        <button onClick={() => setShowGrid(v => !v)} className={`rounded px-2 py-1 text-xs ${showGrid?"bg-blue-100 text-blue-700":"hover:bg-gray-100"}`}>Grid</button>
        <button onClick={zoomToFit} className="rounded px-2 py-1 hover:bg-gray-100 text-xs" title="Fit to screen">⊞</button>
        <button onClick={() => setShowMinimap(!showMinimap)} className={`rounded px-2 py-1 text-xs ${showMinimap?"bg-blue-100 text-blue-700":"hover:bg-gray-100"}`}>Map</button>
      </div>

      {/* Minimap (Improvement 20) */}
      {showMinimap && (
        <div className="fixed bottom-16 right-4 z-30 w-48 h-36 bg-white border rounded-lg shadow-lg overflow-hidden"
          onClick={() => addGuide("horizontal", 100)} title="Click to add a guide">
          <canvas width={192} height={144} className="w-full h-full opacity-70"
            ref={c => { if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return; ctx.fillStyle="#fff"; ctx.fillRect(0,0,192,144); 
              const scale = 0.05; ctx.save(); ctx.scale(scale, scale); ctx.translate(-pan.x/zoom*0.5, -pan.y/zoom*0.5);
              elements.forEach(el => { if (["rect","circle","diamond"].includes(el.tool)) { ctx.strokeStyle=el.color; ctx.lineWidth=el.strokeWidth; ctx.strokeRect(el.x, el.y, el.width||10, el.height||10); } }); ctx.restore();
            }} />
        </div>
      )}

      {/* Text editing overlay */}
      {editingElementId && (
        <textarea autoFocus value={editingText} onChange={e => setEditingText(e.target.value)} onBlur={handleTextBlur}
          onKeyDown={e => { if (e.key==="Escape") (e.target as HTMLTextAreaElement).blur(); }}
          className="absolute z-50 border-2 border-blue-500 bg-white p-0 outline-none resize text-base"
          style={{left:editingPosition.x*zoom+pan.x, top:editingPosition.y*zoom+pan.y, font:"16px Inter, sans-serif", color:strokeColor, minWidth:"100px", minHeight:"30px"}} />
      )}

      {/* Context menu (Improvement 25) */}
      {contextMenu && (
        <div className="fixed z-50 bg-white border rounded-xl shadow-xl py-1 text-sm" style={{left:contextMenu.x, top:contextMenu.y}} onClick={()=>setContextMenu(null)}>
          {contextMenu.elementId ? (
            <>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={()=>{clipboardRef.current=elements.filter(el=>el.isSelected).map(el=>({...el,isSelected:false}))}}>Copy</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={()=>{clipboardRef.current=elements.filter(el=>el.isSelected&&!el.locked).map(el=>({...el,isSelected:false})); pushToHistory(elements.filter(el=>!el.isSelected||el.locked));}}>Cut</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={()=>duplicateSelected()}>Duplicate</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={()=>{pushToHistory(elements.filter(el=>!el.isSelected||el.locked));}}>Delete</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={toggleLock}>Lock/Unlock</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={bringToFront}>Bring to Front</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={sendToBack}>Send to Back</button>
            </>
          ) : (
            <>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={pasteElements}>Paste</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={()=>setElements(elements.map(el=>({...el,isSelected:true})))}>Select All</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={()=>setShowGrid(!showGrid)}>Toggle Grid</button>
            </>
          )}
        </div>
      )}

      {/* Main canvas container */}
      <div ref={containerRef} className="absolute inset-0 z-0" style={{ touchAction: "none" }}>
        <Canvas ref={canvasRef} elements={elements} pan={pan} zoom={zoom} showGrid={showGrid} rubberBand={rubberBand}
          bgTheme={bgTheme} guides={guides} comments={comments}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          cursor={getCursor()} />
      </div>
    </div>
  );
};

export default App;