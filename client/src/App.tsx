import React, { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuid } from "uuid";
import { Canvas } from "./components/Canvas";
import { ToolSidebar } from "./components/ToolSidebar";
import { TopBar } from "./components/TopBar";
import { IconLibrary } from "./components/IconLibrary";
import { AuthPage } from "./components/AuthPage";
import { RoomsPage } from "./components/RoomsPage";
import type { Element, Point, Guide, Comment } from "./lib/types";
import { screenToCanvas, isPointInElement, distanceToSegment } from "./lib/utils";

// Hooks
import { useHistory } from "./hooks/useHistory";
import { useUI } from "./hooks/useUI";
import { useDrawingStyle } from "./hooks/useDrawingStyle";
import { useSocket } from "./hooks/useSocket";

// Services
import * as ExportService from "./services/exportService";
import * as AlignmentService from "./services/alignmentService";
import * as SelectionService from "./services/selectionService";
import * as BoardService from "./services/boardService";
import * as StorageService from "./services/storageService";

// Constants
import { RESIZE_HANDLE_SIZE, EDGE_THRESHOLD } from "./constants/tools";
import { TEMPLATES } from "./constants/templates";

// Handlers
import { handleKeyDown } from "./handlers/keyboardHandlers";
import { handleTextBlur, createTextElement, createStickyNote } from "./handlers/textHandlers";
import { isLongPress } from "./handlers/touchHandlers";

export const App = () => {
  // Core state management
  const { elements, setElements, pushToHistory, undo, redo, canUndo, canRedo, history, historyIndex } = useHistory([]);
  const ui = useUI();
  const drawingStyle = useDrawingStyle();
  
  // View state
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [bgTheme] = useState<"white"|"light-grid"|"dark"|"dark-grid">("light-grid");
  
  // Text editing
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingPosition, setEditingPosition] = useState<Point>({ x: 0, y: 0 });
  
  // Clipboard, rubber-band, grouping
  const clipboardRef = useRef<Element[]>([]);
  const [rubberBand, setRubberBand] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [nextGroupId, setNextGroupId] = useState(1);
  
  // Guides, comments
  const [guides, setGuides] = useState<Guide[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  
  // Multiple boards
  const [boards, setBoards] = useState<BoardService.Board[]>([
    { id: "board-1", name: "Board 1", elements: [] }
  ]);
  const [activeBoardId, setActiveBoardId] = useState("board-1");

  // Authentication and rooms
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [currentRoom, setCurrentRoom] = useState<{ id: number; name: string } | null>(null);

  // Socket
  const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || "http://localhost:3000";
  const { socketConnected, peerCount, sendBoardState } = useSocket(
    SOCKET_URL,
    currentRoom?.id ?? null,
    authToken,
    (updatedElements) => {
      setElements(updatedElements);
    }
  );

  // Auto-save
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Refs
  const currentId = useRef<string | null>(null);
  const offset = useRef<Point>({ x: 0, y: 0 });
  const resizeOrigin = useRef<{ x: number; y: number; el: Element } | null>(null);
  const connectionOrigin = useRef<{ elementId: string; point: Point } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number; dist: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeBoardIdRef = useRef(activeBoardId);
  
  useEffect(() => { activeBoardIdRef.current = activeBoardId; }, [activeBoardId]);
  
  // Sync elements with active board
  useEffect(() => {
    setElements(boards.find(b => b.id === activeBoardId)?.elements || []);
  }, [activeBoardId]);

  useEffect(() => {
    const savedAuth = localStorage.getItem('collab-auth');
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        if (parsed?.token && parsed?.user) {
          setAuthToken(parsed.token);
          setUser(parsed.user);
        }
      } catch {
        localStorage.removeItem('collab-auth');
      }
    }

    const savedRoom = localStorage.getItem('collab-room');
    if (savedRoom) {
      try {
        setCurrentRoom(JSON.parse(savedRoom));
      } catch {
        localStorage.removeItem('collab-room');
      }
    }
  }, []);
  
  const syncBoard = useCallback((els: Element[]) => {
    setBoards(prev => prev.map(b => b.id === activeBoardIdRef.current ? { ...b, elements: els } : b));
  }, []);
  
  // Enhanced push to history with sync
  const pushToHistoryWithSync = useCallback((newElements: Element[]) => {
    syncBoard(newElements);
    pushToHistory(newElements);
    sendBoardState(newElements);
  }, [syncBoard, pushToHistory, sendBoardState]);
  
  // Background theme
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.className = container.className.replace(/bg-\w+-\d*/g, '');
    if (bgTheme.includes('dark')) container.classList.add('bg-gray-900');
    else container.classList.add('bg-gray-50');
  }, [bgTheme]);
  
  const handleAuthSuccess = (user: { id: number; username: string }, token: string) => {
    setUser(user);
    setAuthToken(token);
    localStorage.setItem('collab-auth', JSON.stringify({ user, token }));
  };

  const handleLogout = () => {
    setUser(null);
    setAuthToken(null);
    setCurrentRoom(null);
    localStorage.removeItem('collab-auth');
    localStorage.removeItem('collab-room');
  };

  const handleJoinRoom = (roomId: number, roomName: string) => {
    setCurrentRoom({ id: roomId, name: roomName });
    localStorage.setItem('collab-room', JSON.stringify({ id: roomId, name: roomName }));
  };

  // Auto-save
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      StorageService.saveToLocalStorage(elements, boards, activeBoardId);
    }, 5000);
    
    const saved = StorageService.loadFromLocalStorage();
    if (saved) {
      if (saved.boards) setBoards(saved.boards);
      if (saved.activeBoardId) setActiveBoardId(saved.activeBoardId);
      if (saved.elements) setElements(saved.elements);
    }
    
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, []);
  
  // Helper functions
  const getSelectedElements = (): Element[] => elements.filter(el => el.isSelected);
  const getSelected = () => elements.find(el => el.isSelected);
  
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
      if (ui.presentationMode) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const direction = e.deltaY > 0 ? -1 : 1, step = 0.05;
      setZoom(prev => Math.min(Math.max(prev * (1 + direction * step), 0.1), 5));
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [ui.presentationMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDownEvent = (e: KeyboardEvent) => {
      const action = handleKeyDown(e, elements, historyIndex, ui.presentationMode);
      
      if (!action) return;
      
      switch (action.action) {
        case "undo":
          undo();
          break;
        case "redo":
          redo();
          break;
        case "delete-selected":
          pushToHistoryWithSync(elements.filter(el => !el.isSelected || el.locked));
          break;
        case "copy":
          clipboardRef.current = elements.filter(el => el.isSelected).map(el => ({ ...el, isSelected: false }));
          break;
        case "cut":
          clipboardRef.current = elements.filter(el => el.isSelected && !el.locked).map(el => ({ ...el, isSelected: false }));
          pushToHistoryWithSync(elements.filter(el => !el.isSelected || el.locked));
          break;
        case "paste":
          pushToHistoryWithSync(SelectionService.pasteElements(elements, clipboardRef.current));
          break;
        case "duplicate":
          pushToHistoryWithSync(SelectionService.duplicateSelected(elements));
          break;
        case "select-all":
          setElements(elements.map(el => ({ ...el, isSelected: !el.locked })));
          break;
        case "group":
          const { elements: grouped, nextGroupId: newGroupId } = SelectionService.groupSelected(elements, nextGroupId);
          setNextGroupId(newGroupId);
          pushToHistoryWithSync(grouped);
          break;
        case "ungroup":
          pushToHistoryWithSync(SelectionService.ungroupSelected(elements));
          break;
        case "reset-zoom":
          setZoom(1);
          setPan({ x: 0, y: 0 });
          break;
        case "bring-to-front":
          pushToHistoryWithSync(AlignmentService.bringToFront(elements));
          break;
        case "send-to-back":
          pushToHistoryWithSync(AlignmentService.sendToBack(elements));
          break;
        case "bring-forward":
          pushToHistoryWithSync(AlignmentService.bringForward(elements));
          break;
        case "send-backward":
          pushToHistoryWithSync(AlignmentService.sendBackward(elements));
          break;
        case "align-left":
          pushToHistoryWithSync(AlignmentService.alignSelected(elements, "left"));
          break;
        case "align-right":
          pushToHistoryWithSync(AlignmentService.alignSelected(elements, "right"));
          break;
        case "align-top":
          pushToHistoryWithSync(AlignmentService.alignSelected(elements, "top"));
          break;
        case "align-bottom":
          pushToHistoryWithSync(AlignmentService.alignSelected(elements, "bottom"));
          break;
        case "export-png":
          if (canvasRef.current) ExportService.exportCanvasToPNG(canvasRef.current);
          break;
        case "select-tool":
          ui.setSelectedTool(action.data);
          break;
        case "presentation-next":
          ui.setPresentationIndex(i => Math.min(i + 1, elements.length));
          break;
        case "presentation-prev":
          ui.setPresentationIndex(i => Math.max(i - 1, 0));
          break;
        case "exit-presentation":
          ui.setPresentationMode(false);
          document.exitFullscreen().catch(() => {});
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDownEvent);
    return () => window.removeEventListener("keydown", handleKeyDownEvent);
  }, [elements, historyIndex, ui.presentationMode, nextGroupId]);
  // Z-order operations
  const bringToFront = () => pushToHistoryWithSync(AlignmentService.bringToFront(elements));
  const sendToBack = () => pushToHistoryWithSync(AlignmentService.sendToBack(elements));
  const bringForward = () => pushToHistoryWithSync(AlignmentService.bringForward(elements));
  const sendBackward = () => pushToHistoryWithSync(AlignmentService.sendBackward(elements));

  // Lock/unlock
  const toggleLock = () => pushToHistoryWithSync(SelectionService.toggleLock(elements));

  // Alignment
  const alignSelected = (dir: any) => pushToHistoryWithSync(AlignmentService.alignSelected(elements, dir));

  // Grouping
  const groupSelected = () => {
    const { elements: grouped, nextGroupId: newId } = SelectionService.groupSelected(elements, nextGroupId);
    setNextGroupId(newId);
    pushToHistoryWithSync(grouped);
  };

  const ungroupSelected = () => pushToHistoryWithSync(SelectionService.ungroupSelected(elements));

  // Duplicating and pasting
  const duplicateSelected = () => pushToHistoryWithSync(SelectionService.duplicateSelected(elements));
  
  const pasteElements = () => {
    pushToHistoryWithSync(SelectionService.pasteElements(elements, clipboardRef.current));
  };

  // Add guide
  const addGuide = (type: "horizontal" | "vertical", position: number) => {
    setGuides(prev => [...prev, { id: uuid(), type, position }]);
  };

  // Zoom to fit
  const zoomToFit = () => {
    if (elements.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });
    const padding = 50;
    const fitZoom = Math.min(
      (window.innerWidth - padding * 2) / (maxX - minX),
      (window.innerHeight - padding * 2) / (maxY - minY),
      2
    );
    setZoom(fitZoom);
    setPan({ x: -minX * fitZoom + padding, y: -minY * fitZoom + padding });
  };

  // Import image
  const handleImportImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = uuid();
      pushToHistoryWithSync([
        ...elements,
        {
          id,
          tool: "rect" as any,
          x: 100,
          y: 100,
          width: 200,
          height: 150,
          color: "#000",
          strokeWidth: 0,
          imageData: reader.result as string
        }
      ]);
    };
    reader.readAsDataURL(file);
  };

  // Load template
  const loadTemplate = (name: string) => {
    const tmpl = TEMPLATES[name];
    if (tmpl) {
      pushToHistoryWithSync(tmpl.map(el => ({ ...el, id: uuid(), isSelected: false })));
    }
    ui.setTemplatesOpen(false);
  };

  // Text editing
  const handleTextBlurEvent = () => {
    if (!editingElementId) return;
    const nextElements = handleTextBlur(editingElementId, editingText, elements);
    pushToHistoryWithSync(nextElements);
    setEditingElementId(null);
    setEditingText("");
  };

  // Export functions
  const exportCanvas = () => {
    if (canvasRef.current) {
      ExportService.exportCanvasToPNG(canvasRef.current);
    }
  };

  const exportSVG = () => ExportService.exportCanvasToSVG(elements);
  const exportPDF = () => {
    if (canvasRef.current) {
      ExportService.exportCanvasToPDF(canvasRef.current);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    ui.setContextMenu(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (editingElementId && ui.selectedTool !== "text") setEditingElementId(null);
    
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    const clickedElement = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
    
    if (e.detail === 2 && clickedElement) {
      const shift = e.shiftKey;
      ui.setSelectedTool("select");
      setElements(elements.map(el =>
        el.id === clickedElement.id
          ? { ...el, isSelected: shift ? !el.isSelected : true }
          : shift ? el : { ...el, isSelected: false }
      ));
      ui.setAction("none");
      return;
    }
    
    if (ui.selectedTool === "hand") { ui.setAction("panning"); return; }
    if (ui.selectedTool === "eraser") { ui.setAction("erasing"); return; }
    if (ui.selectedTool === "eyedropper") {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const p = ctx.getImageData(e.clientX, e.clientY, 1, 1).data;
        drawingStyle.setStrokeColor(`#${p[0].toString(16).padStart(2, '0')}${p[1].toString(16).padStart(2, '0')}${p[2].toString(16).padStart(2, '0')}`);
      }
      return;
    }
    if (ui.selectedTool === "text") {
      const id = uuid();
      currentId.current = id;
      setElements([...elements, createTextElement(point, drawingStyle.strokeColor, drawingStyle.opacity)]);
      setEditingElementId(id);
      setEditingText("");
      setEditingPosition(point);
      return;
    }
    if (ui.selectedTool === "sticky") {
      pushToHistoryWithSync([...elements, createStickyNote(point, drawingStyle.opacity)]);
      return;
    }
    if (ui.selectedTool === "icon") { ui.setLibraryOpen(true); return; }

    if (ui.selectedTool === "select") {
      const selectedEl = elements.find(el => el.isSelected && !el.locked);
      if (selectedEl) {
        const bounds = getElementBounds(selectedEl);
        if (isPointNearEdge(point.x, point.y, bounds)) {
          const newId = uuid();
          connectionOrigin.current = { elementId: selectedEl.id, point };
          currentId.current = newId;
          setElements([
            ...elements,
            {
              id: newId,
              tool: "line" as any,
              x: point.x,
              y: point.y,
              width: 0,
              height: 0,
              color: drawingStyle.strokeColor,
              strokeWidth: drawingStyle.strokeWidth,
              opacity: drawingStyle.opacity / 100,
              boundElementIds: { start: selectedEl.id, end: null }
            }
          ]);
          ui.setAction("connecting");
          return;
        }
        const corners = [
          { x: bounds.x, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          { x: bounds.x, y: bounds.y + bounds.height }
        ];
        for (const c of corners) {
          if (Math.hypot(point.x - c.x, point.y - c.y) < RESIZE_HANDLE_SIZE / zoom) {
            ui.setAction("resizing");
            currentId.current = selectedEl.id;
            resizeOrigin.current = { x: point.x, y: point.y, el: selectedEl };
            return;
          }
        }
      }
      const clicked = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
      if (clicked) {
        const shift = e.shiftKey;
        setElements(elements.map(el =>
          el.id === clicked.id
            ? { ...el, isSelected: shift ? !el.isSelected : true }
            : shift ? el : { ...el, isSelected: false }
        ));
        currentId.current = clicked.id;
        offset.current = { x: point.x - clicked.x, y: point.y - clicked.y };
        ui.setAction("moving");
      } else {
        if (!e.shiftKey) setElements(elements.map(el => ({ ...el, isSelected: false })));
        setRubberBand({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      }
      return;
    }

    // Drawing
    const id = uuid();
    currentId.current = id;
    const isPenLike = ["pen", "highlighter"].includes(ui.selectedTool);
    const el: Element = {
      id,
      tool: ui.selectedTool as any,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      color: ui.selectedTool === "highlighter" ? "#FFEB3B" : drawingStyle.strokeColor,
      fillColor:
        ["pen", "line", "arrow", "highlighter"].includes(ui.selectedTool)
          ? undefined
          : drawingStyle.fillColor,
      strokeWidth:
        ui.selectedTool === "highlighter" ? 20 : drawingStyle.strokeWidth,
      opacity:
        ui.selectedTool === "highlighter"
          ? 0.3
          : drawingStyle.opacity / 100,
      points: isPenLike ? [point] : undefined,
      lineStyle:
        ui.selectedTool === "highlighter"
          ? undefined
          : drawingStyle.lineStyle,
      arrowStyle:
        ui.selectedTool === "arrow"
          ? drawingStyle.arrowStyle
          : undefined
    };
    setElements([...elements, el]);
    ui.setAction("drawing");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    
    if (ui.action === "panning") {
      setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    } else if (ui.action === "drawing") {
      setElements(prev =>
        prev.map(el => {
          if (el.id !== currentId.current) return el;
          if (el.tool === "pen")
            return { ...el, points: [...(el.points || []), point] };
          return { ...el, width: point.x - el.x, height: point.y - el.y };
        })
      );
    } else if (ui.action === "moving") {
      setElements(prev =>
        prev.map(el => {
          if (!el.isSelected || el.locked) return el;
          if (el.id === currentId.current)
            return {
              ...el,
              x: point.x - offset.current.x,
              y: point.y - offset.current.y
            };
          const ddx =
            point.x -
            offset.current.x -
            (prev.find(p => p.id === currentId.current)?.x ?? 0);
          const ddy =
            point.y -
            offset.current.y -
            (prev.find(p => p.id === currentId.current)?.y ?? 0);
          return { ...el, x: el.x + ddx, y: el.y + ddy };
        })
      );
    } else if (ui.action === "erasing") {
      setElements(prev =>
        prev.filter(el => {
          if (el.tool === "pen" && el.points) {
            for (let i = 0; i < el.points.length - 1; i++)
              if (
                distanceToSegment(
                  point.x,
                  point.y,
                  el.points[i].x,
                  el.points[i].y,
                  el.points[i + 1].x,
                  el.points[i + 1].y
                ) < drawingStyle.eraserSize
              )
                return false;
            return true;
          }
          return !isPointInElement(point.x, point.y, el);
        })
      );
    } else if (ui.action === "resizing" && currentId.current && resizeOrigin.current) {
      setElements(prev =>
        prev.map(el => {
          if (el.id !== currentId.current) return el;
          let w =
            resizeOrigin.current!.el.width +
            (point.x - resizeOrigin.current!.x);
          let h =
            resizeOrigin.current!.el.height +
            (point.y - resizeOrigin.current!.y);
          return { ...el, width: w, height: h };
        })
      );
    } else if (
      ui.action === "connecting" &&
      currentId.current
    ) {
      const hovered = [...elements].reverse().find(
        el =>
          el.id !== currentId.current &&
          el.id !== connectionOrigin.current?.elementId &&
          isPointInElement(point.x, point.y, el)
      );
      setElements(prev =>
        prev.map(el => {
          if (el.id !== currentId.current) return el;
          const bounds = hovered ? getElementBounds(hovered) : null;
          const tp = bounds
            ? {
                x: bounds.x + bounds.width / 2,
                y: bounds.y + bounds.height / 2
              }
            : point;
          return {
            ...el,
            width: tp.x - el.x,
            height: tp.y - el.y,
            boundElementIds: {
              ...el.boundElementIds,
              end: hovered ? hovered.id : null
            }
          };
        })
      );
    }
    if (rubberBand)
      setRubberBand(prev =>
        prev
          ? {
              ...prev,
              x2: point.x,
              y2: point.y
            }
          : null
      );
  };

  const finishRubberBand = useCallback(() => {
    if (!rubberBand) return;
    const x1 = Math.min(rubberBand.x1, rubberBand.x2);
    const y1 = Math.min(rubberBand.y1, rubberBand.y2);
    const x2 = Math.max(rubberBand.x1, rubberBand.x2);
    const y2 = Math.max(rubberBand.y1, rubberBand.y2);
    setElements(prev =>
      prev.map(el => {
        const b = getElementBounds(el);
        return {
          ...el,
          isSelected:
            (b.x + b.width >= x1 &&
              b.x <= x2 &&
              b.y + b.height >= y1 &&
              b.y <= y2) ||
            el.isSelected
        };
      })
    );
    setRubberBand(null);
  }, [rubberBand]);

  const handleMouseUp = () => {
    if (["drawing", "moving", "resizing", "connecting", "erasing"].includes(ui.action)) {
      pushToHistoryWithSync(elements);
    }
    if (rubberBand) finishRubberBand();
    ui.setAction("none");
    currentId.current = null;
    resizeOrigin.current = null;
    connectionOrigin.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (ui.selectedTool !== "select") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    const clicked = [...elements]
      .reverse()
      .find(el => isPointInElement(point.x, point.y, el));
    if (clicked) {
      setEditingElementId(clicked.id);
      setEditingText(clicked.text || "");
      setEditingPosition({ x: clicked.x, y: clicked.y });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = screenToCanvas(
      e.clientX,
      e.clientY,
      canvas,
      pan,
      zoom
    );
    const clicked = [...elements]
      .reverse()
      .find(el => isPointInElement(point.x, point.y, el));
    ui.setContextMenu({
      x: e.clientX,
      y: e.clientY,
      elementId: clicked?.id
    });
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
        dist: 0
      };
      const me = new MouseEvent("mousedown", {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY
      });
      canvasRef.current?.dispatchEvent(me);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (ui.contextMenu) {
        ui.setContextMenu(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [ui.contextMenu]);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      const me = new MouseEvent("mousemove", {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
        movementX:
          e.touches[0].clientX - touchStartRef.current.x,
        movementY:
          e.touches[0].clientY - touchStartRef.current.y
      });
      canvasRef.current?.dispatchEvent(me);
      touchStartRef.current.x = e.touches[0].clientX;
      touchStartRef.current.y = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchStartRef.current?.dist) {
        const delta = dist - touchStartRef.current.dist;
        if (Math.abs(delta) > 5)
          setZoom(z =>
            Math.max(0.1, Math.min(5, z + delta * 0.005))
          );
      }
      touchStartRef.current = { ...touchStartRef.current!, dist };
    }
  };

  const handleTouchEnd = () => {
    const me = new MouseEvent("mouseup", {});
    canvasRef.current?.dispatchEvent(me);
    if (isLongPress(touchStartRef.current)) {
      const me2 = new MouseEvent("contextmenu", {
        clientX: touchStartRef.current!.x,
        clientY: touchStartRef.current!.y
      });
      handleContextMenu(me2 as unknown as React.MouseEvent);
    }
    touchStartRef.current = null;
  };

  const getCursor = () => {
    if (ui.selectedTool === "hand" || ui.action === "panning") return "grab";
    if (ui.selectedTool === "eraser") return "crosshair";
    if (ui.selectedTool === "text") return "text";
    if (ui.action === "moving") return "move";
    if (ui.action === "resizing") return "nwse-resize";
    return "crosshair";
  };

  const selCount = getSelectedElements().length;

  if (!authToken || !user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (!currentRoom) {
    return <RoomsPage token={authToken} username={user.username} onJoinRoom={handleJoinRoom} onLogout={handleLogout} />;
  }

  if (ui.presentationMode) {
    return (
      <div
        className="h-screen w-screen bg-black flex items-center justify-center"
        onClick={() =>
          ui.setPresentationIndex((i) =>
            Math.min(i + 1, elements.length)
          )
        }
      >
        <div className="text-white text-center">
          <Canvas
            ref={canvasRef}
            elements={elements.slice(0, ui.presentationIndex + 1)}
            pan={{ x: 0, y: 0 }}
            zoom={1}
            showGrid={false}
            rubberBand={null}
            onMouseDown={() => {}}
            onMouseMove={() => {}}
            onMouseUp={() => {}}
            onDoubleClick={() => {}}
            cursor="pointer"
          />
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-gray-400 text-sm">
            {ui.presentationIndex + 1} / {elements.length + 1} · Click or → to
            advance · Esc to exit
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen bg-gray-50 overflow-hidden relative select-none"
      style={{ touchAction: "none" }}
    >
      <div className="fixed top-8 right-4 z-50 flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-md text-sm">
        <div className="font-semibold">Room: {currentRoom?.name}</div>
        <div className="text-slate-600">Logged in as {user?.username}</div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCurrentRoom(null);
              localStorage.removeItem('collab-room');
            }}
            className="rounded-2xl border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            Leave room
          </button>
          <button
            onClick={handleLogout}
            className="rounded-2xl border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>
        </div>
      </div>
      {/* Board tabs */}
      <div className="fixed top-0 left-0 right-0 h-8 bg-gray-100 flex items-center gap-1 px-4 z-50 overflow-x-auto">
        {boards.map((board) => (
          <button
            key={board.id}
            onClick={() => {
              pushToHistoryWithSync(elements);
              setActiveBoardId(board.id);
            }}
            className={`px-3 py-0.5 text-xs rounded-t ${
              board.id === activeBoardId
                ? "bg-white font-semibold"
                : "hover:bg-gray-200"
            }`}
          >
            {board.name}
          </button>
        ))}
        <button
          onClick={() => {
            const id = uuid();
            setBoards([
              ...boards,
              {
                id,
                name: `Board ${boards.length + 1}`,
                elements: []
              }
            ]);
            setActiveBoardId(id);
          }}
          className="px-2 text-xs hover:bg-gray-200 rounded"
        >
          +
        </button>
      </div>

      <TopBar
        onUndo={undo}
        onRedo={redo}
        onClear={() => pushToHistoryWithSync([])}
        onExport={exportCanvas}
        canUndo={canUndo}
        canRedo={canRedo}
        onAlignLeft={() => alignSelected("left")}
        onAlignCenter={() => alignSelected("center")}
        onAlignRight={() => alignSelected("right")}
        onAlignTop={() => alignSelected("top")}
        onAlignMiddle={() => alignSelected("middle")}
        onAlignBottom={() => alignSelected("bottom")}
        onDistributeH={() =>
          alignSelected("distribute-h")
        }
        onDistributeV={() =>
          alignSelected("distribute-v")
        }
        onGroup={groupSelected}
        onUngroup={ungroupSelected}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onBringForward={bringForward}
        onSendBackward={sendBackward}
        onToggleLock={toggleLock}
        onExportSVG={exportSVG}
        onExportPDF={exportPDF}
        hasSelection={selCount > 0}
        hasMultiSelection={selCount > 1}
        onImportImage={handleImportImage}
        onZoomToFit={zoomToFit}
        onFullscreen={() =>
          document.documentElement.requestFullscreen()
        }
        onToggleComments={() =>
          ui.setCommentsPanelOpen(!ui.commentsPanelOpen)
        }
        onToggleLayers={() =>
          ui.setLayersPanelOpen(!ui.layersPanelOpen)
        }
        onToggleProperties={() =>
          ui.setPropertiesPanelOpen(!ui.propertiesPanelOpen)
        }
        onToggleTemplates={() =>
          ui.setTemplatesOpen(!ui.templatesOpen)
        }
        onPresentation={() => {
          ui.setPresentationMode(true);
          ui.setPresentationIndex(-1);
          document.documentElement.requestFullscreen();
        }}
        historyIndex={historyIndex}
        historyLength={history.length}
      />

      <div className="fixed left-4 top-20 z-40 rounded-2xl border bg-white/95 px-4 py-2 text-xs shadow-lg backdrop-blur-md">
        <div className="font-semibold">Realtime status</div>
        <div className="mt-1">
          Connected:{" "}
          <span
            className={`font-bold ${
              socketConnected
                ? "text-green-700"
                : "text-red-700"
            }`}
          >
            {socketConnected ? "Yes" : "No"}
          </span>
        </div>
        <div>
          Peers: <span className="font-semibold">{peerCount}</span>
        </div>
        <div className="text-gray-500">Server: {SOCKET_URL}</div>
      </div>

      <ToolSidebar
        selectedTool={ui.selectedTool}
        setSelectedTool={ui.setSelectedTool}
        strokeColor={drawingStyle.strokeColor}
        fillColor={drawingStyle.fillColor}
        onStrokeColorChange={drawingStyle.setStrokeColor}
        onFillColorChange={drawingStyle.setFillColor}
        strokeWidth={drawingStyle.strokeWidth}
        onStrokeWidthChange={drawingStyle.setStrokeWidth}
        opacity={drawingStyle.opacity}
        onOpacityChange={drawingStyle.setOpacity}
        lineStyle={drawingStyle.lineStyle}
        onLineStyleChange={drawingStyle.setLineStyle}
        arrowStyle={drawingStyle.arrowStyle}
        onArrowStyleChange={drawingStyle.setArrowStyle}
        eraserSize={drawingStyle.eraserSize}
        onEraserSizeChange={drawingStyle.setEraserSize}
        presetColors={drawingStyle.presetColors}
        recentColors={drawingStyle.recentColors}
        onOpenLibrary={() =>
          ui.setLibraryOpen(!ui.isLibraryOpen)
        }
        onAddGuide={addGuide}
        canvasRef={canvasRef}
        pan={pan}
        zoom={zoom}
      />

      {/* Properties panel */}
      {ui.propertiesPanelOpen && getSelected() && (
        <div className="fixed right-4 top-20 bg-white shadow-xl rounded-2xl border p-4 z-50 w-56">
          <h3 className="font-bold text-sm mb-3">Properties</h3>
          {(() => {
            const el = getSelected();
            if (!el) return null;
            return (
              <div className="space-y-2 text-xs">
                <div>
                  Type: <span className="font-mono">{el.tool}</span>
                </div>
                <div className="flex gap-2">
                  <span>X:</span>
                  <input
                    type="number"
                    value={Math.round(el.x)}
                    onChange={(e) =>
                      pushToHistoryWithSync(
                        elements.map((ee) =>
                          ee.id === el.id
                            ? { ...ee, x: Number(e.target.value) }
                            : ee
                        )
                      )
                    }
                    className="w-16 border rounded px-1"
                  />
                </div>
                <div className="flex gap-2">
                  <span>Y:</span>
                  <input
                    type="number"
                    value={Math.round(el.y)}
                    onChange={(e) =>
                      pushToHistoryWithSync(
                        elements.map((ee) =>
                          ee.id === el.id
                            ? { ...ee, y: Number(e.target.value) }
                            : ee
                        )
                      )
                    }
                    className="w-16 border rounded px-1"
                  />
                </div>
                <div className="flex gap-2">
                  <span>W:</span>
                  <input
                    type="number"
                    value={Math.round(el.width)}
                    onChange={(e) =>
                      pushToHistoryWithSync(
                        elements.map((ee) =>
                          ee.id === el.id
                            ? { ...ee, width: Number(e.target.value) }
                            : ee
                        )
                      )
                    }
                    className="w-16 border rounded px-1"
                  />
                </div>
                <div className="flex gap-2">
                  <span>H:</span>
                  <input
                    type="number"
                    value={Math.round(el.height)}
                    onChange={(e) =>
                      pushToHistoryWithSync(
                        elements.map((ee) =>
                          ee.id === el.id
                            ? { ...ee, height: Number(e.target.value) }
                            : ee
                        )
                      )
                    }
                    className="w-16 border rounded px-1"
                  />
                </div>
                <div>
                  <label>Color</label>
                  <input
                    type="color"
                    value={el.color}
                    onChange={(e) =>
                      pushToHistoryWithSync(
                        elements.map((ee) =>
                          ee.id === el.id
                            ? { ...ee, color: e.target.value }
                            : ee
                        )
                      )
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label>
                    Opacity ({Math.round((el.opacity ?? 1) * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={(el.opacity ?? 1) * 100}
                    onChange={(e) =>
                      pushToHistoryWithSync(
                        elements.map((ee) =>
                          ee.id === el.id
                            ? {
                                ...ee,
                                opacity:
                                  Number(e.target.value) / 100
                              }
                            : ee
                        )
                      )
                    }
                    className="w-full"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Layers panel */}
      {ui.layersPanelOpen && (
        <div className="fixed right-4 top-20 bg-white shadow-xl rounded-2xl border p-4 z-50 w-56 max-h-96 overflow-y-auto">
          <h3 className="font-bold text-sm mb-3">Layers</h3>
          {[...elements]
            .reverse()
            .map((el, i) => (
              <div
                key={el.id}
                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
                  el.isSelected
                    ? "bg-blue-100"
                    : "hover:bg-gray-50"
                }`}
                onClick={() =>
                  setElements(
                    elements.map((ee) => ({
                      ...ee,
                      isSelected: ee.id === el.id
                    }))
                  )
                }
              >
                <span className="text-gray-400 w-4">
                  {elements.length - i}
                </span>
                <span className="flex-1 truncate">
                  {el.tool}
                  {el.text
                    ? `: ${el.text.slice(0, 15)}`
                    : ""}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLock();
                  }}
                  className="text-gray-400 hover:text-gray-700"
                >
                  {el.locked ? "🔒" : "🔓"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    pushToHistoryWithSync(
                      elements.filter((ee) => ee.id !== el.id)
                    );
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Comments panel */}
      {ui.commentsPanelOpen && (
        <div className="fixed right-4 top-20 bg-white shadow-xl rounded-2xl border p-4 z-50 w-64 max-h-96 overflow-y-auto">
          <h3 className="font-bold text-sm mb-3">Comments</h3>
          {comments
            .filter((c) => !c.resolved)
            .map((c) => (
              <div
                key={c.id}
                className="text-xs border-b pb-2 mb-2"
              >
                <div className="text-gray-500">
                  {new Date(
                    c.timestamp
                  ).toLocaleString()}
                </div>
                <div className="my-1">{c.text}</div>
                <button
                  onClick={() =>
                    setComments(
                      comments.map((cc) =>
                        cc.id === c.id
                          ? { ...cc, resolved: true }
                          : cc
                      )
                    )
                  }
                  className="text-green-600"
                >
                  ✓ Resolve
                </button>
              </div>
            ))}
          {
            comments.filter((c) => !c.resolved).length ===
              0 && (
              <div className="text-xs text-gray-400">
                No comments. Use Select tool, right-click to
                add.
              </div>
            )
          }
        </div>
      )}

      {/* Templates modal */}
      {ui.templatesOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
          onClick={() => ui.setTemplatesOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-96 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-lg mb-4">Templates</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(TEMPLATES).map((name) => (
                <button
                  key={name}
                  onClick={() => loadTemplate(name)}
                  className="p-4 border rounded-xl hover:bg-blue-50 hover:border-blue-200 text-sm font-medium"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {ui.isLibraryOpen && (
        <IconLibrary
          onSelect={(icon) => {
            const id = uuid();
            pushToHistoryWithSync([
              ...elements,
              {
                id,
                tool: "icon" as any,
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                color: icon.color,
                fillColor: icon.color,
                strokeWidth: 0,
                opacity: drawingStyle.opacity / 100,
                icon: icon.name,
                iconName: icon.name,
                iconColor: icon.color,
                svgPaths: icon.svgPaths,
                viewBox: icon.viewBox
              }
            ]);
            ui.setLibraryOpen(false);
          }}
          onClose={() => ui.setLibraryOpen(false)}
        />
      )}

      {/* Zoom controls + minimap */}
      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-xl border bg-white p-3 shadow-lg">
        <button
          onClick={() =>
            setZoom((z) => Math.min(z * 1.1, 4))
          }
          className="rounded px-2 py-1 hover:bg-gray-100 text-sm font-bold"
        >
          +
        </button>
        <span className="font-mono text-xs w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() =>
            setZoom((z) =>
              Math.max(z / 1.1, 0.1)
            )
          }
          className="rounded px-2 py-1 hover:bg-gray-100 text-sm font-bold"
        >
          −
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={() =>
            ui.setShowGrid(!ui.showGrid)
          }
          className={`rounded px-2 py-1 text-xs ${
            ui.showGrid
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          Grid
        </button>
        <button
          onClick={zoomToFit}
          className="rounded px-2 py-1 hover:bg-gray-100 text-xs"
          title="Fit to screen"
        >
          ⊞
        </button>
        <button
          onClick={() =>
            ui.setShowMinimap(!ui.showMinimap)
          }
          className={`rounded px-2 py-1 text-xs ${
            ui.showMinimap
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          Map
        </button>
      </div>

      {/* Minimap */}
      {ui.showMinimap && (
        <div
          className="fixed bottom-16 right-4 z-30 w-48 h-36 bg-white border rounded-lg shadow-lg overflow-hidden"
          onClick={() => addGuide("horizontal", 100)}
          title="Click to add a guide"
        >
          <canvas
            width={192}
            height={144}
            className="w-full h-full opacity-70"
            ref={(c) => {
              if (!c) return;
              const ctx = c.getContext("2d");
              if (!ctx) return;
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, 192, 144);
              const scale = 0.05;
              ctx.save();
              ctx.scale(scale, scale);
              ctx.translate(
                (-pan.x / zoom) * 0.5,
                (-pan.y / zoom) * 0.5
              );
              elements.forEach((el) => {
                if (
                  ["rect", "circle", "diamond"].includes(
                    el.tool
                  )
                ) {
                  ctx.strokeStyle = el.color;
                  ctx.lineWidth = el.strokeWidth;
                  ctx.strokeRect(
                    el.x,
                    el.y,
                    el.width || 10,
                    el.height || 10
                  );
                }
              });
              ctx.restore();
            }}
          />
        </div>
      )}

      {/* Text editing overlay */}
      {editingElementId && (
        <textarea
          autoFocus
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={handleTextBlurEvent}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          className="fixed z-50 border-2 border-blue-500 bg-white p-2 outline-none resize text-base rounded shadow-lg"
          style={{
            left: `${
              editingPosition.x * zoom + pan.x
            }px`,
            top: `${editingPosition.y * zoom + pan.y}px`,
            font: "16px Inter, sans-serif",
            color: drawingStyle.strokeColor,
            minWidth: "120px",
            minHeight: "36px",
            maxWidth: "400px"
          }}
        />
      )}

      {/* Context menu */}
      {ui.contextMenu && (
        <div
          className="fixed z-50 bg-white border rounded-xl shadow-xl py-1 text-sm"
          style={{
            left: ui.contextMenu.x,
            top: ui.contextMenu.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {ui.contextMenu.elementId ? (
            <>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  clipboardRef.current = elements
                    .filter(
                      (el) =>
                        el.isSelected
                    )
                    .map((el) => ({
                      ...el,
                      isSelected: false
                    }));
                  ui.setContextMenu(null);
                }}
              >
                Copy
              </button>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  clipboardRef.current = elements
                    .filter(
                      (el) =>
                        el.isSelected &&
                        !el.locked
                    )
                    .map((el) => ({
                      ...el,
                      isSelected: false
                    }));
                  pushToHistoryWithSync(
                    elements.filter(
                      (el) =>
                        !el.isSelected ||
                        el.locked
                    )
                  );
                  ui.setContextMenu(null);
                }}
              >
                Cut
              </button>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  duplicateSelected();
                  ui.setContextMenu(null);
                }}
              >
                Duplicate
              </button>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  pushToHistoryWithSync(
                    elements.filter(
                      (el) =>
                        !el.isSelected ||
                        el.locked
                    )
                  );
                  ui.setContextMenu(null);
                }}
              >
                Delete
              </button>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  toggleLock();
                  ui.setContextMenu(null);
                }}
              >
                Lock/Unlock
              </button>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  bringToFront();
                  ui.setContextMenu(null);
                }}
              >
                Bring to Front
              </button>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  sendToBack();
                  ui.setContextMenu(null);
                }}
              >
                Send to Back
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  pasteElements();
                  ui.setContextMenu(null);
                }}
              >
                Paste
              </button>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  setElements(
                    elements.map((el) => ({
                      ...el,
                      isSelected: true
                    }))
                  );
                  ui.setContextMenu(null);
                }}
              >
                Select All
              </button>
              <button
                className="w-full px-4 py-1.5 hover:bg-gray-100 text-left"
                onClick={() => {
                  ui.setShowGrid(
                    !ui.showGrid
                  );
                  ui.setContextMenu(null);
                }}
              >
                Toggle Grid
              </button>
            </>
          )}
        </div>
      )}

      {/* Main canvas container */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-0"
        style={{ touchAction: "none" }}
      >
        <Canvas
          ref={canvasRef}
          elements={elements}
          pan={pan}
          zoom={zoom}
          showGrid={ui.showGrid}
          rubberBand={rubberBand}
          bgTheme={bgTheme}
          guides={guides}
          comments={comments}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          cursor={getCursor()}
        />
      </div>
    </div>
  );
};

export default App;