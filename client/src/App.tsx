import React, { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuid } from "uuid";
import toast from "react-hot-toast";
import { Canvas } from "./components/Canvas";
import { ToolSidebar } from "./components/ToolSidebar";
import { TopBar } from "./components/TopBar";
import { IconLibrary } from "./components/IconLibrary";
import { AuthPage } from "./components/AuthPage";
import { RoomsPage } from "./components/RoomsPage";
import { Minimap } from "./components/Minimap";
import { RoomInfo } from "./components/RoomInfo";
import { RealtimeStatus } from "./components/RealtimeStatus";
import { BoardTabs } from "./components/BoardTabs";
import { ChatPanel } from "./components/ChatPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { LayersPanel } from "./components/LayersPanel";
import { ZoomControls } from "./components/ZoomControls";
import { DiagramPanel } from "./components/DiagramPanel";
import type { Element, Point, Guide, Comment, Connector, TextStyle, ReshapeHandle } from "./lib/types";
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
import * as ConnectorService from "./services/connectorService";

// Constants
import { RESIZE_HANDLE_SIZE, EDGE_THRESHOLD } from "./constants/tools";
import { TEMPLATES } from "./constants/templates";

// Handlers
import { handleKeyDown } from "./handlers/keyboardHandlers";
import { getReshapeHandleAtPoint } from "./lib/renderer";
import { handleTextBlur, createTextElement, createStickyNote } from "./handlers/textHandlers";
import { isLongPress } from "./handlers/touchHandlers";

export const App = () => {
  // =========================================================
  // STATE
  // =========================================================
  const { elements, setElements, pushToHistory, updateElementsFromServer, undo, redo, canUndo, canRedo, history, historyIndex } = useHistory([]);
  const ui = useUI();
  const drawingStyle = useDrawingStyle();

  const [defaultTextStyle, setDefaultTextStyle] = useState<TextStyle>("rough");
  const cycleTextStyle = () => {
    const order: TextStyle[] = ["rough", "clean", "mono"];
    const next = order[(order.indexOf(defaultTextStyle) + 1) % order.length];
    setDefaultTextStyle(next);
  };

  // View
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [bgTheme, setBgTheme] = useState<"white" | "light-grid" | "dark" | "dark-grid">("light-grid");

  // Text editing
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Clipboard, rubber-band, grouping
  const clipboardRef = useRef<Element[]>([]);
  const [rubberBand, setRubberBand] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [nextGroupId, setNextGroupId] = useState(1);

  // Guides, comments, connectors
  const [guides, setGuides] = useState<Guide[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectionPreview, setConnectionPreview] = useState<{
    sourceId: string; sourceAnchor: string; targetId: string | null; mousePos: Point;
  } | null>(null);
  const [diagramPanelOpen, setDiagramPanelOpen] = useState(false);

  // Boards
  const [boards, setBoards] = useState<BoardService.Board[]>([{ id: "board-1", name: "Board 1", elements: [] }]);
  const [activeBoardId, setActiveBoardId] = useState("board-1");

  // Auth & Rooms
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [currentRoom, setCurrentRoom] = useState<{ id: string | number; name: string } | null>(null);

  // Socket
  const defaultSocketUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";
  const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || defaultSocketUrl;
  const lastReceivedConnectorsJson = useRef<string>("");
  const lastReceivedCommentsJson = useRef<string>("");

  const setElementsClean = useCallback((val: Element[] | ((prev: Element[]) => Element[])) => {
    updateElementsFromServer(prev => {
      const resolved = typeof val === "function" ? val(prev) : val;
      const connElement = resolved.find(el => el.id === "__connectors_state__");
      if (connElement && connElement.text) {
        if (connElement.text !== lastReceivedConnectorsJson.current) {
          lastReceivedConnectorsJson.current = connElement.text;
          try {
            const parsed = JSON.parse(connElement.text);
            setConnectors(parsed);
          } catch (e) {
            console.error("Failed to parse connectors:", e);
          }
        }
      }
      const commElement = resolved.find(el => el.id === "__comments_state__");
      if (commElement && commElement.text) {
        if (commElement.text !== lastReceivedCommentsJson.current) {
          lastReceivedCommentsJson.current = commElement.text;
          try {
            setComments(JSON.parse(commElement.text));
          } catch (e) {
            console.error("Failed to parse comments:", e);
          }
        }
      }
      return resolved.filter(el => el.id !== "__connectors_state__" && el.id !== "__comments_state__");
    });
  }, [updateElementsFromServer]);

  const [messages, setMessages] = useState<any[]>([]);
  const { socketRef, socketConnected, peerCount, sendChat, createElement, updateElement, deleteElement } = useSocket(
    SOCKET_URL, currentRoom?.id ?? null, authToken,
    setElementsClean,
    (msgs) => setMessages(msgs as any[]),
    (req) => {
      toast((t) => (
        <div className="flex flex-col gap-2 p-1 font-sans">
          <p className="text-xs font-semibold text-slate-800">
            👤 <span className="font-bold text-indigo-600">{req.user.username}</span> requests to join the room.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                socketRef?.current?.emit("join-response", { socketId: req.socketId, accept: false });
                toast.dismiss(t.id);
                toast.error(`Denied access to ${req.user.username}`);
              }}
              className="px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
            >
              Deny
            </button>
            <button
              onClick={() => {
                socketRef?.current?.emit("join-response", { socketId: req.socketId, accept: true });
                toast.dismiss(t.id);
                toast.success(`Allowed ${req.user.username} to join`);
              }}
              className="px-2.5 py-1 text-[11px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
            >
              Accept
            </button>
          </div>
        </div>
      ), {
        duration: 15000,
        position: "top-center",
      });
    },
    (msg) => {
      if (!ui.commentsPanelOpen && msg.username !== user?.username) {
        toast(`💬 ${msg.username}: ${msg.message}`, {
          icon: '💬',
          duration: 4000,
          position: "bottom-left",
        });
      }
    }
  );

  const throttledUpdateElementRef = useRef<Record<string, number>>({});
  const throttledUpdateElement = useCallback((el: Element) => {
    const now = Date.now();
    const lastEmit = throttledUpdateElementRef.current[el.id] || 0;
    if (now - lastEmit > 50) { // Limit to 20fps for low-overhead smooth collaboration
      updateElement(el);
      throttledUpdateElementRef.current[el.id] = now;
    }
  }, [updateElement]);

  // Refs
  const currentId = useRef<string | null>(null);
  const offset = useRef<Point>({ x: 0, y: 0 });
  const selectionOrigin = useRef<Point | null>(null);
  const resizeOrigin = useRef<{ x: number; y: number; el: Element } | null>(null);
  const connectionOrigin = useRef<{ elementId: string; point: Point } | null>(null);
  const reshapeOrigin = useRef<{ handle: ReshapeHandle; startMouse: Point; startEl: Element } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number; dist: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeBoardIdRef = useRef(activeBoardId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const elementsRef = useRef<Element[]>(elements);
  const connectorsRef = useRef<Connector[]>(connectors);
  const actionStartElements = useRef<Element[] | null>(null);

  // FIX: Add lastMousePos ref for accurate delta tracking
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });
  const reconnectConnectorInfo = useRef<{ connectorId: string; end: "source" | "target" } | null>(null);

  // Keep refs in sync
  useEffect(() => { activeBoardIdRef.current = activeBoardId; }, [activeBoardId]);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { connectorsRef.current = connectors; }, [connectors]);

  // Sync connectors state to server (via special elements channel metadata)
  useEffect(() => {
    if (socketConnected && currentRoom && socketRef.current) {
      const json = JSON.stringify(connectors);
      if (json !== lastReceivedConnectorsJson.current) {
        lastReceivedConnectorsJson.current = json;
        const connElement: Element = {
          id: "__connectors_state__",
          tool: "select" as any,
          x: 0, y: 0, width: 0, height: 0,
          color: "", strokeWidth: 0,
          text: json,
        };
        socketRef.current.emit("element-update", connElement);
      }
      
      const cjson = JSON.stringify(comments);
      if (cjson !== lastReceivedCommentsJson.current) {
        lastReceivedCommentsJson.current = cjson;
        const commElement: Element = {
          id: "__comments_state__",
          tool: "select" as any,
          x: 0, y: 0, width: 0, height: 0,
          color: "", strokeWidth: 0,
          text: cjson,
        };
        socketRef.current.emit("element-update", commElement);
      }
    }
  }, [connectors, comments, socketConnected, currentRoom]);

  // Sync elements with active board
  useEffect(() => {
    setElements(boards.find(b => b.id === activeBoardId)?.elements || []);
  }, [activeBoardId]);

  // Auth Init
  useEffect(() => {
    const savedAuth = localStorage.getItem('collab-auth');
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        if (parsed?.token && parsed?.user) {
          const parts = parsed.token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const isExpired = payload.exp && payload.exp * 1000 < Date.now();
            if (isExpired) {
              console.warn('[auth] Stored token is expired — clearing');
              localStorage.removeItem('collab-auth');
              localStorage.removeItem('collab-room');
            } else {
              setAuthToken(parsed.token);
              setUser(parsed.user);
              console.log('[auth] Restored session for:', parsed.user.username);
            }
          } else {
            localStorage.removeItem('collab-auth');
          }
        }
      } catch {
        localStorage.removeItem('collab-auth');
      }
    }
    const savedRoom = localStorage.getItem('collab-room');
    if (savedRoom) {
      try { setCurrentRoom(JSON.parse(savedRoom)); } catch { localStorage.removeItem('collab-room'); }
    }
  }, []);

  const syncBoard = useCallback((els: Element[]) => {
    setBoards(prev => prev.map(b => b.id === activeBoardIdRef.current ? { ...b, elements: els } : b));
  }, []);

  const syncElementsDiff = useCallback((prevElements: Element[], nextElements: Element[]) => {
    if (socketConnected && currentRoom) {
      const prevMap = new Map(prevElements.map(el => [el.id, el]));
      const nextMap = new Map(nextElements.map(el => [el.id, el]));
      
      nextElements.forEach(el => {
        const prev = prevMap.get(el.id);
        if (!prev) {
          createElement(el);
        } else if (
          prev.x !== el.x ||
          prev.y !== el.y ||
          prev.width !== el.width ||
          prev.height !== el.height ||
          prev.text !== el.text ||
          prev.color !== el.color ||
          prev.fillColor !== el.fillColor ||
          prev.strokeWidth !== el.strokeWidth ||
          prev.opacity !== el.opacity ||
          prev.lineStyle !== el.lineStyle ||
          prev.arrowStyle !== el.arrowStyle ||
          prev.locked !== el.locked ||
          prev.points?.length !== el.points?.length ||
          JSON.stringify(prev.boundElementIds) !== JSON.stringify(el.boundElementIds)
        ) {
          updateElement(el);
        }
      });
      
      prevElements.forEach(el => {
        if (!nextMap.has(el.id)) {
          deleteElement(el.id);
        }
      });
    }
  }, [socketConnected, currentRoom, createElement, updateElement, deleteElement]);

  const pushToHistoryWithSync = useCallback((newElements: Element[]) => {
    syncBoard(newElements);
    const prevElements = actionStartElements.current || elementsRef.current;
    pushToHistory(newElements);
    syncElementsDiff(prevElements, newElements);
  }, [syncBoard, pushToHistory, syncElementsDiff]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevElements = elements;
      const nextElements = history[historyIndex - 1];
      undo();
      syncElementsDiff(prevElements, nextElements);
      syncBoard(nextElements);
    }
  }, [historyIndex, history, elements, undo, syncElementsDiff, syncBoard]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const prevElements = elements;
      const nextElements = history[historyIndex + 1];
      redo();
      syncElementsDiff(prevElements, nextElements);
      syncBoard(nextElements);
    }
  }, [historyIndex, history, elements, redo, syncElementsDiff, syncBoard]);

  // Background theme
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.className = container.className.replace(/bg-\w+-\d*/g, "");
    container.classList.add(bgTheme.includes("dark") ? "bg-gray-900" : "bg-gray-50");
  }, [bgTheme]);

  // =========================================================
  // HANDLERS
  // =========================================================
  const handleAuthSuccess = (user: { id: number; username: string }, token: string) => {
    setUser(user);
    setAuthToken(token);
    localStorage.setItem("collab-auth", JSON.stringify({ user, token }));
  };
  const handleLogout = () => {
    setUser(null); setAuthToken(null); setCurrentRoom(null);
    localStorage.removeItem("collab-auth"); localStorage.removeItem("collab-room");
  };
  const handleJoinRoom = (roomId: string | number, roomName: string) => {
    setCurrentRoom({ id: roomId, name: roomName });
    localStorage.setItem("collab-room", JSON.stringify({ id: roomId, name: roomName }));
  };

  // Auto-save
  useEffect(() => {
    if (currentRoom) return;

    const timer = setInterval(() => {
      StorageService.saveToLocalStorage(elementsRef.current, boards, activeBoardIdRef.current);
    }, 5000);
    const saved = StorageService.loadFromLocalStorage();
    if (saved) {
      if (saved.boards) setBoards(saved.boards);
      if (saved.activeBoardId) setActiveBoardId(saved.activeBoardId);
      if (saved.elements) setElements(saved.elements);
    }
    return () => clearInterval(timer);
  }, [currentRoom]);

  // Helpers
  const getSelectedElements = (): Element[] => elements.filter(el => el.isSelected);
  const getSelected = () => elements.find(el => el.isSelected);

  const getElementBoundsLocal = (el: Element) => {
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

  const isPointNearEdge = (px: number, py: number, bounds: { x: number; y: number; width: number; height: number }) => {
    const { x, y, width, height } = bounds;
    return px >= x - EDGE_THRESHOLD && px <= x + width + EDGE_THRESHOLD &&
      py >= y - EDGE_THRESHOLD && py <= y + height + EDGE_THRESHOLD &&
      !(px >= x + EDGE_THRESHOLD && px <= x + width - EDGE_THRESHOLD &&
        py >= y + EDGE_THRESHOLD && py <= y + height - EDGE_THRESHOLD);
  };

  const getEdgeAnchors = (el: Element): Array<{ x: number; y: number; side: string }> => {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return [
      { x: cx, y: el.y, side: "top" },
      { x: cx, y: el.y + el.height, side: "bottom" },
      { x: el.x, y: cy, side: "left" },
      { x: el.x + el.width, y: cy, side: "right" },
    ];
  };

  const findBestAnchorPair = (source: Element, target: Element) => {
    const sAnchors = getEdgeAnchors(source);
    const tAnchors = getEdgeAnchors(target);
    let best = { s: sAnchors[0], t: tAnchors[0], dist: Infinity };
    for (const sa of sAnchors) {
      for (const ta of tAnchors) {
        const dist = Math.hypot(sa.x - ta.x, sa.y - ta.y);
        if (dist < best.dist) best = { s: sa, t: ta, dist };
      }
    }
    return { sourceAnchor: best.s, targetAnchor: best.t };
  };

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (ui.presentationMode) return;
      const delta = e.deltaY > 0 ? -1 : 1;
      setZoom(prev => Math.min(Math.max(prev * (1 + delta * 0.08), 0.1), 5));
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [ui.presentationMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDownEvent = (e: KeyboardEvent) => {
      if (editingElementId) return;
      const action = handleKeyDown(e, ui.presentationMode);
      if (!action) return;
      switch (action.action) {
        case "undo": handleUndo(); break;
        case "redo": handleRedo(); break;
        case "delete-selected": {
          const activeIds = new Set(elements.filter(el => !el.isSelected || el.locked).map(el => el.id));
          setConnectors(prev => prev.filter(c => !c.isSelected && activeIds.has(c.sourceId) && activeIds.has(c.targetId)));
          pushToHistoryWithSync(elements.filter(el => !el.isSelected || el.locked));
          break;
        }
        case "copy":
          clipboardRef.current = elements.filter(el => el.isSelected).map(el => ({ ...el, isSelected: false }));
          if (clipboardRef.current.length > 0) {
            toast.success(`Copied ${clipboardRef.current.length} element(s)`);
          }
          break;
        case "cut": {
          clipboardRef.current = elements.filter(el => el.isSelected && !el.locked).map(el => ({ ...el, isSelected: false }));
          const cutIds = new Set(elements.filter(el => el.isSelected && !el.locked).map(el => el.id));
          setConnectors(prev => prev.filter(c => !cutIds.has(c.sourceId) && !cutIds.has(c.targetId)));
          pushToHistoryWithSync(elements.filter(el => !el.isSelected || el.locked));
          if (clipboardRef.current.length > 0) {
            toast.success(`Cut ${clipboardRef.current.length} element(s)`);
          }
          break;
        }
        case "paste":
          if (clipboardRef.current.length > 0) {
            pushToHistoryWithSync(SelectionService.pasteElements(elements, clipboardRef.current));
            toast.success("Pasted elements");
          } else {
            toast.error("Clipboard is empty");
          }
          break;
        case "duplicate":
          const selected = elements.filter(el => el.isSelected);
          if (selected.length > 0) {
            pushToHistoryWithSync(SelectionService.duplicateSelected(elements));
            toast.success("Duplicated elements");
          }
          break;
        case "select-all": setElements(elements.map(el => ({ ...el, isSelected: !el.locked }))); break;
        case "group": {
          const { elements: grouped, nextGroupId: newGroupId } = SelectionService.groupSelected(elements, nextGroupId);
          setNextGroupId(newGroupId);
          pushToHistoryWithSync(grouped);
          break;
        }
        case "ungroup": pushToHistoryWithSync(SelectionService.ungroupSelected(elements)); break;
        case "reset-zoom": setZoom(1); setPan({ x: 0, y: 0 }); break;
        case "bring-to-front": pushToHistoryWithSync(AlignmentService.bringToFront(elements)); break;
        case "send-to-back": pushToHistoryWithSync(AlignmentService.sendToBack(elements)); break;
        case "bring-forward": pushToHistoryWithSync(AlignmentService.bringForward(elements)); break;
        case "send-backward": pushToHistoryWithSync(AlignmentService.sendBackward(elements)); break;
        case "align-left": pushToHistoryWithSync(AlignmentService.alignSelected(elements, "left")); break;
        case "align-right": pushToHistoryWithSync(AlignmentService.alignSelected(elements, "right")); break;
        case "align-top": pushToHistoryWithSync(AlignmentService.alignSelected(elements, "top")); break;
        case "align-bottom": pushToHistoryWithSync(AlignmentService.alignSelected(elements, "bottom")); break;
        case "export-png":
          if (canvasRef.current) {
            const parent = canvasRef.current.parentElement;
            const allCanvases = parent?.querySelectorAll('canvas');
            if (allCanvases && allCanvases.length > 0) {
              const composite = document.createElement('canvas');
              composite.width = allCanvases[0].width;
              composite.height = allCanvases[0].height;
              const cctx = composite.getContext('2d');
              if (cctx) {
                allCanvases.forEach(c => cctx.drawImage(c, 0, 0));
                ExportService.exportCanvasToPNG(composite);
              }
            } else {
              ExportService.exportCanvasToPNG(canvasRef.current);
            }
          }
          break;
        case "select-tool": ui.setSelectedTool(action.data); break;
        case "presentation-next": ui.setPresentationIndex(i => Math.min(i + 1, elements.length)); break;
        case "presentation-prev": ui.setPresentationIndex(i => Math.max(i - 1, 0)); break;
        case "exit-presentation": ui.setPresentationMode(false); document.exitFullscreen().catch(() => { }); break;
      }
    };
    window.addEventListener("keydown", handleKeyDownEvent);
    return () => window.removeEventListener("keydown", handleKeyDownEvent);
  }, [elements, historyIndex, ui.presentationMode, nextGroupId, editingElementId]);

  const bringToFront = () => pushToHistoryWithSync(AlignmentService.bringToFront(elements));
  const sendToBack = () => pushToHistoryWithSync(AlignmentService.sendToBack(elements));
  const toggleLock = () => {
    pushToHistoryWithSync(SelectionService.toggleLock(elements));
    toast.success("Toggled lock on selection");
  };
  const alignSelected = (dir: any) => pushToHistoryWithSync(AlignmentService.alignSelected(elements, dir));
  const groupSelected = () => {
    const { elements: grouped, nextGroupId: newId } = SelectionService.groupSelected(elements, nextGroupId);
    setNextGroupId(newId);
    pushToHistoryWithSync(grouped);
    toast.success("Grouped selected elements");
  };
  const ungroupSelected = () => {
    pushToHistoryWithSync(SelectionService.ungroupSelected(elements));
    toast.success("Ungrouped elements");
  };
  const duplicateSelected = () => {
    const selected = elements.filter(el => el.isSelected);
    if (selected.length > 0) {
      pushToHistoryWithSync(SelectionService.duplicateSelected(elements));
      toast.success("Duplicated elements");
    }
  };
  const pasteElements = () => {
    if (clipboardRef.current.length > 0) {
      pushToHistoryWithSync(SelectionService.pasteElements(elements, clipboardRef.current));
      toast.success("Pasted elements");
    } else {
      toast.error("Clipboard is empty");
    }
  };

  const addGuide = (type: "horizontal" | "vertical", position: number) => {
    setGuides(prev => [...prev, { id: uuid(), type, position }]);
  };

  const zoomToFit = () => {
    if (elements.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      const b = getElementBoundsLocal(el);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
    });
    const padding = 50;
    const fitZoom = Math.min((window.innerWidth - padding * 2) / (maxX - minX), (window.innerHeight - padding * 2) / (maxY - minY), 2);
    setZoom(fitZoom);
    setPan({ x: -minX * fitZoom + padding, y: -minY * fitZoom + padding });
  };

  const handleImportImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      pushToHistoryWithSync([...elements, {
        id: uuid(), tool: "rect" as any, x: 100, y: 100, width: 200, height: 150,
        color: "#000", strokeWidth: 0, imageData: reader.result as string, resizable: true,
      }]);
    };
    reader.readAsDataURL(file);
  };

  const loadTemplate = (name: string) => {
    const tmpl = TEMPLATES[name];
    if (tmpl) pushToHistoryWithSync(tmpl.map(el => ({ ...el, id: uuid(), isSelected: false, resizable: true })));
    ui.setTemplatesOpen(false);
  };

  const updateElements = useCallback((id: string, updates: Partial<Element>) => {
    pushToHistoryWithSync(elements.map(el => (el.id === id ? { ...el, ...updates } : el)));
  }, [elements, pushToHistoryWithSync]);

  const handleAutoAttachConnector = useCallback((sourceEl: Element, targetEl: Element, customElements?: Element[]) => {
    if (sourceEl.id === targetEl.id) return;
    const { sourceAnchor, targetAnchor } = findBestAnchorPair(sourceEl, targetEl);
    const newConnector = ConnectorService.createAutoConnector(sourceEl, targetEl, [], {
      arrowStyle: "filled",
      lineStyle: drawingStyle.lineStyle || "solid",
      color: drawingStyle.strokeColor || "#000",
      strokeWidth: drawingStyle.strokeWidth || 2,
    });
    newConnector.sourceAnchor = `${sourceEl.id}-${sourceAnchor.side}`;
    newConnector.targetAnchor = `${targetEl.id}-${targetAnchor.side}`;

    setConnectors(prev => [...prev, newConnector]);
    const baseElements = customElements || elements;
    const updatedElements = baseElements.map(el => {
      if (el.id === sourceEl.id || el.id === targetEl.id) {
        const connectedIds = [...(el.connectedElementIds || [])];
        const otherId = el.id === sourceEl.id ? targetEl.id : sourceEl.id;
        if (!connectedIds.includes(otherId)) connectedIds.push(otherId);
        return { ...el, connectedElementIds: connectedIds };
      }
      return el;
    });
    pushToHistoryWithSync(updatedElements);
  }, [elements, drawingStyle, pushToHistoryWithSync]);

  const handleReshape = useCallback((el: Element, handle: ReshapeHandle, mouseDelta: Point): Element => {
    const updated = { ...el };
    switch (handle) {
      case "start-point":
        if (el.tool === "line" || el.tool === "arrow") {
          updated.x += mouseDelta.x; updated.y += mouseDelta.y;
          updated.width -= mouseDelta.x; updated.height -= mouseDelta.y;
        } else if (el.points && el.points.length > 0) {
          const points = [...el.points];
          points[0] = { x: points[0].x + mouseDelta.x, y: points[0].y + mouseDelta.y };
          updated.points = points;
        }
        break;
      case "end-point":
        if (el.tool === "line" || el.tool === "arrow") {
          updated.width += mouseDelta.x; updated.height += mouseDelta.y;
        } else if (el.points && el.points.length > 0) {
          const points = [...el.points];
          points[points.length - 1] = { x: points[points.length - 1].x + mouseDelta.x, y: points[points.length - 1].y + mouseDelta.y };
          updated.points = points;
        }
        break;
      case "top-left": updated.x += mouseDelta.x; updated.y += mouseDelta.y; updated.width -= mouseDelta.x; updated.height -= mouseDelta.y; break;
      case "top-center": updated.y += mouseDelta.y; updated.height -= mouseDelta.y; break;
      case "top-right": updated.y += mouseDelta.y; updated.width += mouseDelta.x; updated.height -= mouseDelta.y; break;
      case "middle-left": updated.x += mouseDelta.x; updated.width -= mouseDelta.x; break;
      case "middle-right": updated.width += mouseDelta.x; break;
      case "bottom-left": updated.x += mouseDelta.x; updated.width -= mouseDelta.x; updated.height += mouseDelta.y; break;
      case "bottom-center": updated.height += mouseDelta.y; break;
      case "bottom-right": updated.width += mouseDelta.x; updated.height += mouseDelta.y; break;
    }
    if (Math.abs(updated.width) < 10) updated.width = el.width > 0 ? 10 : -10;
    if (Math.abs(updated.height) < 10) updated.height = el.height > 0 ? 10 : -10;
    return { ...updated, lastModified: Date.now() };
  }, []);

  const handleTextBlurEvent = () => {
    if (!editingElementId) return;
    const nextElements = handleTextBlur(editingElementId, editingText, elements);
    pushToHistoryWithSync(nextElements);
    setEditingElementId(null);
    setEditingText("");
  };

  const exportCanvas = () => {
    if (canvasRef.current) {
      const parent = canvasRef.current.parentElement;
      const allCanvases = parent?.querySelectorAll('canvas');
      if (allCanvases && allCanvases.length > 1) {
        const composite = document.createElement('canvas');
        composite.width = allCanvases[0].width;
        composite.height = allCanvases[0].height;
        const cctx = composite.getContext('2d');
        if (cctx) {
          allCanvases.forEach(c => cctx.drawImage(c, 0, 0));
          ExportService.exportCanvasToPNG(composite);
          toast.success("Board exported as PNG!");
          return;
        }
      }
      ExportService.exportCanvasToPNG(canvasRef.current);
      toast.success("Board exported as PNG!");
    }
  };
  const exportSVG = () => {
    ExportService.exportCanvasToSVG(elements);
    toast.success("Board exported as SVG!");
  };
  const exportPDF = () => {
    if (canvasRef.current) {
      ExportService.exportCanvasToPDF(canvasRef.current);
      toast.success("Board exported as PDF!");
    }
  };

  // =========================================================
  // CANVAS MOUSE HANDLERS - FIXED
  // =========================================================

  const handleMouseDown = (e: React.MouseEvent) => {
    actionStartElements.current = elements;
    ui.setContextMenu(null);
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastMousePos.current = { x: e.clientX, y: e.clientY };

    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    const clickedElement = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));

    console.log('[mousedown] detail:', e.detail, 'editingElementId:', editingElementId, 'clickedElement:', clickedElement?.id ?? null);

    if (e.detail === 2) {
      console.log('[doubleclick via mousedown] target element:', clickedElement?.id ?? 'none (create text)');
      if (editingElementId) {
        handleTextBlurEvent();
      }
      if (clickedElement) {
        ui.setSelectedTool('select');
        const otherSelected = elements.filter(el => el.isSelected && el.id !== clickedElement.id);
        if (otherSelected.length > 0) {
          handleAutoAttachConnector(clickedElement, otherSelected[0]);
        }
        setEditingElementId(clickedElement.id);
        setEditingText(clickedElement.text || '');
        console.log('[doubleclick] editing element:', clickedElement.id);
      } else {
        const id = uuid();
        currentId.current = id;
        const newEl = createTextElement(point, drawingStyle.strokeColor, drawingStyle.opacity);
        newEl.textStyle = defaultTextStyle;
        newEl.resizable = true;
        setElements([...elements, { ...newEl, id }]);
        setEditingElementId(id);
        setEditingText('');
        console.log('[doubleclick] created new text element:', id);
      }
      return;
    }

    if (editingElementId) {
      handleTextBlurEvent();
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
      const newEl = createTextElement(point, drawingStyle.strokeColor, drawingStyle.opacity);
      newEl.textStyle = defaultTextStyle;
      newEl.resizable = true;
      setElements([...elements, newEl]);
      setEditingElementId(id);
      setEditingText("");
      return;
    }
    if (ui.selectedTool === "sticky") {
      pushToHistoryWithSync([...elements, createStickyNote(point, drawingStyle.opacity)]);
      return;
    }
    if (ui.selectedTool === "icon") { ui.setLibraryOpen(true); return; }
    if (ui.selectedTool === "comment") {
      const newComment: Comment = {
        id: uuid(),
        x: point.x,
        y: point.y,
        text: "",
        author: user?.username || "Guest",
        timestamp: Date.now(),
        resolved: false,
      };
      setComments(prev => [...prev, newComment]);
      setActiveCommentId(newComment.id);
      ui.setSelectedTool("select");
      return;
    }

    if (ui.selectedTool === "arrow") {
      const clicked = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
      if (clicked) {
        const newId = uuid();
        connectionOrigin.current = { elementId: clicked.id, point };
        currentId.current = newId;
        setElements([...elements, {
          id: newId, tool: "arrow" as any, x: point.x, y: point.y, width: 0, height: 0,
          color: drawingStyle.strokeColor, strokeWidth: drawingStyle.strokeWidth,
          opacity: drawingStyle.opacity / 100,
          boundElementIds: { start: clicked.id, end: null },
          arrowStyle: drawingStyle.arrowStyle, resizable: true,
        }]);
        ui.setAction("connecting");
        return;
      }
    }

    if (ui.selectedTool === "select") {
      const clickedComment = comments.find(c => Math.hypot(point.x - c.x, point.y - c.y) < 15 / zoom);
      if (clickedComment) {
        setActiveCommentId(clickedComment.id);
        return;
      } else {
        setActiveCommentId(null);
      }
      const selectedConnector = connectors.find(c => c.isSelected);
      if (selectedConnector) {
        const sourceEl = elements.find(el => el.id === selectedConnector.sourceId);
        const targetEl = elements.find(el => el.id === selectedConnector.targetId);
        if (sourceEl && targetEl) {
          const { sourceAnchor, targetAnchor } = findBestAnchorPair(sourceEl, targetEl);
          const distToStart = Math.hypot(point.x - sourceAnchor.x, point.y - sourceAnchor.y);
          const distToEnd = Math.hypot(point.x - targetAnchor.x, point.y - targetAnchor.y);
          const handleThreshold = 12 / zoom;
          if (distToStart < handleThreshold) {
            ui.setAction("reconnecting-connector");
            reconnectConnectorInfo.current = { connectorId: selectedConnector.id, end: "source" };
            return;
          } else if (distToEnd < handleThreshold) {
            ui.setAction("reconnecting-connector");
            reconnectConnectorInfo.current = { connectorId: selectedConnector.id, end: "target" };
            return;
          }
        }
      }

      const selectedEls = elements.filter(el => el.isSelected && !el.locked);

      for (const selectedEl of selectedEls) {
        const reshapeHandle = getReshapeHandleAtPoint(point.x, point.y, selectedEl, zoom);
        if (reshapeHandle) {
          const isCornerOrPoint = ["top-left", "top-right", "bottom-left", "bottom-right", "start-point", "end-point"].includes(reshapeHandle);
          if (isCornerOrPoint) {
            ui.setAction("resizing");
            currentId.current = selectedEl.id;
            reshapeOrigin.current = { handle: reshapeHandle, startMouse: point, startEl: selectedEl };
            return;
          } else {
            // Side handle connection port
            const newId = uuid();
            connectionOrigin.current = { elementId: selectedEl.id, point };
            currentId.current = newId;
            setElements([...elements, {
              id: newId, tool: "arrow" as any, x: point.x, y: point.y, width: 0, height: 0,
              color: drawingStyle.strokeColor, strokeWidth: drawingStyle.strokeWidth,
              opacity: drawingStyle.opacity / 100,
              boundElementIds: { start: selectedEl.id, end: null }, resizable: true,
              arrowStyle: "filled",
            }]);
            ui.setAction("connecting");
            return;
          }
        }
      }

      for (const selectedEl of selectedEls) {
        const bounds = getElementBoundsLocal(selectedEl);
        if (isPointNearEdge(point.x, point.y, bounds)) {
          const newId = uuid();
          connectionOrigin.current = { elementId: selectedEl.id, point };
          currentId.current = newId;
          setElements([...elements, {
            id: newId, tool: "arrow" as any, x: point.x, y: point.y, width: 0, height: 0,
            color: drawingStyle.strokeColor, strokeWidth: drawingStyle.strokeWidth,
            opacity: drawingStyle.opacity / 100,
            boundElementIds: { start: selectedEl.id, end: null }, resizable: true,
            arrowStyle: "filled",
          }]);
          ui.setAction("connecting");
          return;
        }
      }

      for (const selectedEl of selectedEls) {
        const bounds = getElementBoundsLocal(selectedEl);
        const corners = [
          { x: bounds.x, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          { x: bounds.x, y: bounds.y + bounds.height },
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
        setConnectors(prev => prev.map(c => ({ ...c, isSelected: false })));
        const shift = e.shiftKey;
        const nextElements = elements.map(el =>
          el.id === clicked.id
            ? { ...el, isSelected: shift ? !el.isSelected : true }
            : shift ? el : { ...el, isSelected: false }
        );
        setElements(nextElements);
        currentId.current = clicked.id;
        offset.current = { x: point.x - clicked.x, y: point.y - clicked.y };
        // FIX: Store the element's original position for absolute movement calculation
        selectionOrigin.current = { x: clicked.x, y: clicked.y };
        ui.setAction("moving");
        return;
      }

      const clickedConnector = [...connectors].reverse().find(c => {
        const sourceEl = elements.find(el => el.id === c.sourceId);
        const targetEl = elements.find(el => el.id === c.targetId);
        if (!sourceEl || !targetEl) return false;
        return ConnectorService.isPointNearConnector(point.x, point.y, c, elements, 10 / zoom);
      });

      if (clickedConnector) {
        setElements(elements.map(el => ({ ...el, isSelected: false })));
        setConnectors(prev => prev.map(c => ({ ...c, isSelected: c.id === clickedConnector.id })));
        return;
      }

      setConnectors(prev => prev.map(c => ({ ...c, isSelected: false })));
      if (!e.shiftKey) setElements(elements.map(el => ({ ...el, isSelected: false })));
      if (e.shiftKey) {
        setRubberBand({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      } else {
        ui.setAction("panning");
      }
      return;
    }

    const id = uuid();
    currentId.current = id;
    const isPenLike = ["pen", "highlighter"].includes(ui.selectedTool);
    const el: Element = {
      id, tool: ui.selectedTool as any,
      x: point.x, y: point.y, width: 0, height: 0,
      color: drawingStyle.strokeColor,
      fillColor: ["pen", "line", "arrow", "highlighter"].includes(ui.selectedTool) ? undefined : drawingStyle.fillColor,
      strokeWidth: ui.selectedTool === "highlighter" ? 25 : drawingStyle.strokeWidth,
      opacity: drawingStyle.opacity / 100,
      points: isPenLike ? [point] : undefined,
      lineStyle: drawingStyle.lineStyle,
      arrowStyle: ui.selectedTool === "arrow" ? drawingStyle.arrowStyle : undefined,
      resizable: true,
    };
    setElements([...elements, el]);
    ui.setAction("drawing");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);

    // FIX: Calculate screen-space delta, then convert to canvas-space
    const screenDeltaX = e.clientX - lastMousePos.current.x;
    const screenDeltaY = e.clientY - lastMousePos.current.y;
    const canvasDeltaX = screenDeltaX / zoom;
    const canvasDeltaY = screenDeltaY / zoom;

    // Update last mouse position
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (ui.action === "panning") {
      // FIX: Panning uses screen delta (not divided by zoom) for 1:1 movement
      setPan((prev) => ({ x: prev.x + screenDeltaX, y: prev.y + screenDeltaY }));
    } else if (ui.action === "drawing") {
      let updatedEl: Element | null = null;
      setElements((prev) => prev.map((el) => {
        if (el.id !== currentId.current) return el;
        if (el.tool === "pen" || el.tool === "highlighter") {
          updatedEl = { ...el, points: [...(el.points || []), point] };
        } else {
          updatedEl = { ...el, width: point.x - el.x, height: point.y - el.y };
        }
        return updatedEl;
      }));
      if (updatedEl) {
        throttledUpdateElement(updatedEl);
      }
    } else if (ui.action === "moving") {
      // FIX: Use canvas delta for smooth, zoom-independent movement
      const updatedElements: Element[] = [];
      setElements((prev) =>
        prev.map((el) => {
          if (!el.isSelected || el.locked) return el;
          const updated = {
            ...el,
            x: el.x + canvasDeltaX,
            y: el.y + canvasDeltaY,
            lastModified: Date.now()
          };
          updatedElements.push(updated);
          return updated;
        })
      );
      updatedElements.forEach((el) => throttledUpdateElement(el));
    } else if (ui.action === "erasing") {
      const deletedIds: string[] = [];
      setElements((prev) => prev.filter((el) => {
        let keep = true;
        if (el.tool === "pen" && el.points) {
          for (let i = 0; i < el.points.length - 1; i++) {
            if (distanceToSegment(point.x, point.y, el.points[i].x, el.points[i].y, el.points[i + 1].x, el.points[i + 1].y) < drawingStyle.eraserSize) {
              keep = false;
              break;
            }
          }
        } else {
          keep = !isPointInElement(point.x, point.y, el);
        }
        if (!keep) {
          deletedIds.push(el.id);
        }
        return keep;
      }));
      deletedIds.forEach((id) => deleteElement(id));
    } else if (ui.action === "resizing" && currentId.current) {
      let updatedEl: Element | null = null;
      if (reshapeOrigin.current) {
        // FIX: Calculate cumulative delta from original position
        const delta = {
          x: point.x - reshapeOrigin.current.startMouse.x,
          y: point.y - reshapeOrigin.current.startMouse.y
        };
        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== currentId.current) return el;
            updatedEl = handleReshape(reshapeOrigin.current!.startEl, reshapeOrigin.current!.handle, delta);
            return updatedEl;
          })
        );
      } else if (resizeOrigin.current) {
        setElements((prev) => prev.map((el) => {
          if (el.id !== currentId.current) return el;
          updatedEl = { ...el, width: point.x - resizeOrigin.current!.el.x, height: point.y - resizeOrigin.current!.el.y };
          return updatedEl;
        }));
      }
      if (updatedEl) {
        throttledUpdateElement(updatedEl);
      }
    } else if (ui.action === "connecting" && currentId.current) {
      const hovered = [...elements].reverse().find((el) =>
        el.id !== currentId.current &&
        el.id !== connectionOrigin.current?.elementId &&
        isPointInElement(point.x, point.y, el)
      );
      if (connectionOrigin.current) {
        setConnectionPreview({
          sourceId: connectionOrigin.current.elementId,
          sourceAnchor: "center",
          targetId: hovered?.id || null,
          mousePos: point
        });
      }
      let updatedEl: Element | null = null;
      setElements((prev) => prev.map((el) => {
        if (el.id !== currentId.current) return el;
        const bounds = hovered ? getElementBoundsLocal(hovered) : null;
        const tp = bounds ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : point;
        updatedEl = {
          ...el,
          width: tp.x - el.x,
          height: tp.y - el.y,
          boundElementIds: { ...el.boundElementIds, end: hovered ? hovered.id : null }
        };
        return updatedEl;
      }));
      if (updatedEl) {
        throttledUpdateElement(updatedEl);
      }
    } else if (ui.action === "reconnecting-connector" && reconnectConnectorInfo.current) {
      const { connectorId, end } = reconnectConnectorInfo.current;
      const conn = connectors.find(c => c.id === connectorId);
      if (conn) {
        const hovered = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
        if (end === "target") {
          const sourceEl = elements.find(el => el.id === conn.sourceId);
          if (sourceEl) {
            setConnectionPreview({
              sourceId: conn.sourceId,
              sourceAnchor: "center",
              targetId: hovered?.id || null,
              mousePos: point
            });
          }
        } else {
          const targetEl = elements.find(el => el.id === conn.targetId);
          if (targetEl) {
            setConnectionPreview({
              sourceId: conn.targetId,
              sourceAnchor: "center",
              targetId: hovered?.id || null,
              mousePos: point
            });
          }
        }
      }
    }

    if (rubberBand) {
      setRubberBand((prev) => prev ? { ...prev, x2: point.x, y2: point.y } : null);
    }
  };

  const finishRubberBand = useCallback(() => {
    if (!rubberBand) return;
    const x1 = Math.min(rubberBand.x1, rubberBand.x2);
    const y1 = Math.min(rubberBand.y1, rubberBand.y2);
    const x2 = Math.max(rubberBand.x1, rubberBand.x2);
    const y2 = Math.max(rubberBand.y1, rubberBand.y2);
    setElements(prev => prev.map(el => {
      const b = getElementBoundsLocal(el);
      return { ...el, isSelected: (b.x + b.width >= x1 && b.x <= x2 && b.y + b.height >= y1 && b.y <= y2) || el.isSelected };
    }));
    setRubberBand(null);
  }, [rubberBand]);

  const handleMouseUp = () => {
    try {
      let nextElements = elements;
      let didConnect = false;

      if (ui.action === "reconnecting-connector" && reconnectConnectorInfo.current) {
        const { connectorId, end } = reconnectConnectorInfo.current;
        const conn = connectors.find(c => c.id === connectorId);
        if (conn) {
          const canvas = canvasRef.current;
          if (canvas) {
            const point = screenToCanvas(lastMousePos.current.x, lastMousePos.current.y, canvas, pan, zoom);
            const hovered = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
            if (hovered && hovered.id !== (end === "source" ? conn.targetId : conn.sourceId)) {
              setConnectors(prev => prev.map(c => {
                if (c.id === connectorId) {
                  const updated = { ...c };
                  if (end === "source") {
                    updated.sourceId = hovered.id;
                  } else {
                    updated.targetId = hovered.id;
                  }
                  const sourceEl = elements.find(el => el.id === updated.sourceId);
                  const targetEl = elements.find(el => el.id === updated.targetId);
                  if (sourceEl && targetEl) {
                    const { sourceAnchor, targetAnchor } = findBestAnchorPair(sourceEl, targetEl);
                    updated.sourceAnchor = `${sourceEl.id}-${sourceAnchor.side}`;
                    updated.targetAnchor = `${targetEl.id}-${targetAnchor.side}`;
                  }
                  updated.lastModified = Date.now();
                  return updated;
                }
                return c;
              }));
              toast.success("Connector reconnected!");
            }
          }
        }
        reconnectConnectorInfo.current = null;
        return;
      }

      if (ui.action === "connecting" && connectionOrigin.current && currentId.current) {
        const currentEl = elements.find(el => el.id === currentId.current);
        const endId = currentEl?.boundElementIds?.end;
        if (endId) {
          nextElements = elements.filter(el => el.id !== currentId.current);
          const targetEl = nextElements.find(el => el.id === endId);
          const sourceEl = nextElements.find(el => el.id === connectionOrigin.current!.elementId);
          if (sourceEl && targetEl) {
            handleAutoAttachConnector(sourceEl, targetEl, nextElements);
            didConnect = true;
          }
        }
      }

      if (["drawing", "moving", "resizing", "connecting", "erasing"].includes(ui.action)) {
        setConnectors(prev => ConnectorService.refreshAllConnectors(prev, nextElements));
        if (!didConnect) {
          pushToHistoryWithSync(nextElements);
        }
      }
      if (rubberBand) finishRubberBand();
    } finally {
      setConnectionPreview(null);
      ui.setAction("none");
      currentId.current = null;
      resizeOrigin.current = null;
      reshapeOrigin.current = null;
      connectionOrigin.current = null;
      selectionOrigin.current = null;
      actionStartElements.current = null;
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    console.log('[handleDoubleClick] fired — handled in mousedown via e.detail===2');
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    const clicked = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
    if (clicked && !clicked.isSelected) {
      setElements(elements.map(el => el.id === clicked.id ? { ...el, isSelected: true } : { ...el, isSelected: false }));
    }
    ui.setContextMenu({ x: e.clientX, y: e.clientY, elementId: clicked?.id });
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now(), dist: 0 };
      const fakeEvent = {
        clientX: touch.clientX, clientY: touch.clientY,
        shiftKey: false, detail: 1, button: 0,
        target: canvasRef.current, currentTarget: canvasRef.current,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
        nativeEvent: { device: "touch" },
        buttons: 1, altKey: false, ctrlKey: false, metaKey: false,
        getModifierState: () => false,
        movementX: 0, movementY: 0,
      } as unknown as React.MouseEvent;
      handleMouseDown(fakeEvent);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      const touch = e.touches[0];
      const fakeEvent = {
        clientX: touch.clientX, clientY: touch.clientY,
        shiftKey: false, detail: 1, button: 0,
        target: canvasRef.current, currentTarget: canvasRef.current,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
        nativeEvent: { device: "touch" },
        buttons: 1, altKey: false, ctrlKey: false, metaKey: false,
        getModifierState: () => false,
        movementX: touch.clientX - touchStartRef.current.x,
        movementY: touch.clientY - touchStartRef.current.y,
      } as unknown as React.MouseEvent;
      handleMouseMove(fakeEvent);
      touchStartRef.current.x = touch.clientX;
      touchStartRef.current.y = touch.clientY;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (touchStartRef.current?.dist) {
        const delta = dist - touchStartRef.current.dist;
        if (Math.abs(delta) > 5) setZoom(z => Math.max(0.1, Math.min(5, z + delta * 0.005)));
      }
      touchStartRef.current = { ...touchStartRef.current!, dist };
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
    if (isLongPress(touchStartRef.current)) {
      const fakeEvent = {
        clientX: touchStartRef.current!.x, clientY: touchStartRef.current!.y,
        preventDefault: () => { }, shiftKey: false, detail: 1, button: 2,
        target: canvasRef.current,
      } as unknown as React.MouseEvent;
      handleContextMenu(fakeEvent);
    }
    touchStartRef.current = null;
  };

  useEffect(() => {
    const handleClickOutside = () => { if (ui.contextMenu) ui.setContextMenu(null); };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [ui.contextMenu]);

  const getCursor = () => {
    if (ui.selectedTool === "hand" || ui.action === "panning") return "grab";
    if (ui.selectedTool === "eraser") return "crosshair";
    if (ui.selectedTool === "text") return "text";
    if (ui.action === "moving") return "move";
    if (ui.action === "resizing") return "nwse-resize";
    return "crosshair";
  };

  const selCount = getSelectedElements().length;

  const editingElement = editingElementId ? elements.find(el => el.id === editingElementId) : null;
  const editingElementBounds = editingElement ? getElementBoundsLocal(editingElement) : null;
  const textareaStyle = editingElement && editingElementBounds ? (
    editingElement.tool === "text" ? {
      left: `${editingElementBounds.x * zoom + pan.x}px`,
      top: `${editingElementBounds.y * zoom + pan.y}px`,
      width: `${Math.max(editingElementBounds.width * zoom, 120)}px`,
      minHeight: `${Math.max(editingElementBounds.height * zoom, 36)}px`,
      fontFamily: defaultTextStyle === "mono" ? "monospace" : "Inter, sans-serif",
      fontSize: `${Math.max(16, editingElementBounds.height * 0.6)}px`,
      color: editingElement.color,
      textAlign: "left" as const,
    } : {
      // Shape elements: center textarea inside the shape
      left: `${(editingElementBounds.x + editingElementBounds.width / 2) * zoom + pan.x - Math.max(120, editingElementBounds.width * zoom - 20) / 2}px`,
      top: `${(editingElementBounds.y + editingElementBounds.height / 2) * zoom + pan.y - Math.max(36, editingElementBounds.height * zoom - 20) / 2}px`,
      width: `${Math.max(120, editingElementBounds.width * zoom - 20)}px`,
      minHeight: `${Math.max(36, editingElementBounds.height * zoom - 20)}px`,
      fontFamily: defaultTextStyle === "mono" ? "monospace" : "Inter, sans-serif",
      fontSize: `${Math.max(14, Math.min(24, editingElementBounds.height * zoom * 0.15))}px`,
      color: editingElement.color,
      textAlign: "center" as const,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
    }
  ) : {};

  if (!authToken || !user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }
  if (!currentRoom) {
    return <RoomsPage token={authToken} username={user.username} onJoinRoom={handleJoinRoom} onLogout={handleLogout} />;
  }

  if (ui.presentationMode) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center" onClick={() => ui.setPresentationIndex(i => Math.min(i + 1, elements.length))}>
        <div className="text-white text-center">
          <Canvas
            ref={canvasRef}
            elements={elements.slice(0, ui.presentationIndex + 1)}
            connectors={[]}
            pan={{ x: 0, y: 0 }}
            zoom={1}
            showGrid={false}
            rubberBand={null}
            defaultTextStyle={defaultTextStyle}
            editingElementId={null}
            onMouseDown={() => { }}
            onMouseMove={() => { }}
            onMouseUp={() => { }}
            onDoubleClick={() => { }}
            cursor="pointer"
          />
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-gray-400 text-sm">
            {ui.presentationIndex + 1} / {elements.length + 1} · Click or → to advance · Esc to exit
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-50 overflow-hidden relative select-none" style={{ touchAction: "none" }}>

      {/* Room Info */}
      <RoomInfo
        currentRoom={currentRoom}
        username={user?.username || ""}
        socketConnected={socketConnected}
        peerCount={peerCount}
        onLeaveRoom={() => {
          setCurrentRoom(null);
          localStorage.removeItem("collab-room");
        }}
        onLogout={handleLogout}
      />

      {/* Board Tabs */}
      <BoardTabs
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={(id) => {
          pushToHistoryWithSync(elements);
          setActiveBoardId(id);
        }}
        onAddBoard={() => {
          const id = uuid();
          setBoards([...boards, { id, name: `Board ${boards.length + 1}`, elements: [] }]);
          setActiveBoardId(id);
        }}
      />

      {/* Top Controls Bar */}
      <TopBar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={exportCanvas}
        canUndo={canUndo}
        canRedo={canRedo}
        onAlignLeft={() => alignSelected("left")}
        onAlignCenter={() => alignSelected("center")}
        onAlignRight={() => alignSelected("right")}
        onAlignTop={() => alignSelected("top")}
        onAlignMiddle={() => alignSelected("middle")}
        onAlignBottom={() => alignSelected("bottom")}
        onGroup={groupSelected}
        onUngroup={ungroupSelected}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onToggleLock={toggleLock}
        onExportSVG={exportSVG}
        onExportPDF={exportPDF}
        hasSelection={selCount > 0}
        hasMultiSelection={selCount > 1}
        onImportImage={handleImportImage}
        onZoomToFit={zoomToFit}
        onFullscreen={() => document.documentElement.requestFullscreen()}
        onToggleComments={() => ui.setCommentsPanelOpen(!ui.commentsPanelOpen)}
        onToggleLayers={() => ui.setLayersPanelOpen(!ui.layersPanelOpen)}
        onToggleProperties={() => ui.setPropertiesPanelOpen(!ui.propertiesPanelOpen)}
        onToggleTemplates={() => ui.setTemplatesOpen(!ui.templatesOpen)}
        onToggleDiagramEditor={() => setDiagramPanelOpen(!diagramPanelOpen)}
        onPresentation={() => {
          ui.setPresentationMode(true);
          ui.setPresentationIndex(-1);
          document.documentElement.requestFullscreen();
        }}
        historyIndex={historyIndex}
        historyLength={history.length}
        onCycleTextStyle={cycleTextStyle}
      />

      {/* Diagram-as-Code Panel */}
      {diagramPanelOpen && (
        <DiagramPanel
          onGenerate={(parsedElements, parsedConnectors) => {
            const newElements = [...elements, ...parsedElements];
            if (parsedConnectors.length > 0) {
              setConnectors(prev => [...prev, ...parsedConnectors]);
            }
            pushToHistoryWithSync(newElements);
            setDiagramPanelOpen(false);
          }}
          onClose={() => setDiagramPanelOpen(false)}
        />
      )}

      {/* Chat Panel */}
      {ui.commentsPanelOpen && (
        <ChatPanel
          messages={messages}
          onSendMessage={(text) => {
            sendChat(text);
            setMessages(prev => [
              ...prev,
              {
                id: `local-${Date.now()}`,
                username: user?.username || "me",
                message: text,
                created_at: new Date().toISOString()
              }
            ]);
          }}
          username={user?.username || ""}
        />
      )}

      {/* Realtime Status Indicator */}
      <RealtimeStatus
        socketConnected={socketConnected}
        peerCount={peerCount}
        SOCKET_URL={SOCKET_URL}
      />

      {/* Tools Sidebar */}
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
        onOpenLibrary={() => ui.setLibraryOpen(!ui.isLibraryOpen)}
        onAddGuide={addGuide}
        canvasRef={canvasRef}
        pan={pan}
        zoom={zoom}
      />

      {/* Properties panel */}
      {ui.propertiesPanelOpen && getSelected() && (
        <PropertiesPanel
          selectedElement={getSelected()}
          onUpdateElement={updateElements}
          defaultTextStyle={defaultTextStyle}
        />
      )}

      {/* Layers panel */}
      {ui.layersPanelOpen && (
        <LayersPanel
          elements={elements}
          onSelectLayer={(id) => setElements(elements.map(ee => ({ ...ee, isSelected: ee.id === id })))}
          onToggleLock={toggleLock}
          onDeleteLayer={(id) => {
            setConnectors(prev => prev.filter(c => c.sourceId !== id && c.targetId !== id));
            pushToHistoryWithSync(elements.filter(ee => ee.id !== id));
          }}
        />
      )}

      {/* Templates modal */}
      {ui.templatesOpen && (
        <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center" onClick={() => ui.setTemplatesOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-4">Templates</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(TEMPLATES).map(name => (
                <button key={name} onClick={() => loadTemplate(name)} className="p-4 border rounded-xl hover:bg-blue-50 hover:border-blue-200 text-sm font-medium">{name}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Icon Library */}
      {ui.isLibraryOpen && (
        <IconLibrary onSelect={(icon) => {
          pushToHistoryWithSync([...elements, {
            id: uuid(), tool: "icon" as any, x: 100, y: 100, width: 50, height: 50,
            color: icon.color, fillColor: icon.color, strokeWidth: 0, opacity: drawingStyle.opacity / 100,
            icon: icon.name, iconName: icon.name, iconColor: icon.color, svgPaths: icon.svgPaths, viewBox: icon.viewBox, resizable: true,
          }]);
          ui.setLibraryOpen(false);
        }} onClose={() => ui.setLibraryOpen(false)} />
      )}

      {/* Zoom controls */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={() => setZoom(z => Math.min(z * 1.2, 4))}
        onZoomOut={() => setZoom(z => Math.max(z / 1.2, 0.1))}
        showGrid={ui.showGrid}
        onToggleGrid={() => ui.setShowGrid(!ui.showGrid)}
        onZoomToFit={zoomToFit}
        showMinimap={ui.showMinimap}
        onToggleMinimap={() => ui.setShowMinimap(!ui.showMinimap)}
        bgTheme={bgTheme}
        onBgThemeChange={setBgTheme}
      />

      {/* Minimap (moved to component to avoid wasteful inline draws) */}
      {ui.showMinimap && (
        <div className="fixed bottom-16 right-4 z-30 w-48 h-36 bg-white border rounded-lg shadow-lg overflow-hidden">
          <Minimap elements={elements} pan={pan} zoom={zoom} />
        </div>
      )}

      {/* Text editing overlay */}
      {editingElementId && editingElement && (
        <textarea
          ref={textareaRef}
          autoFocus
          value={editingText}
          onChange={e => setEditingText(e.target.value)}
          onBlur={handleTextBlurEvent}
          onKeyDown={e => {
            e.stopPropagation(); // Prevents tool selection and other global shortcuts while typing
            if (e.key === "Escape") { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
          }}
          className="fixed z-[200] border-2 border-blue-500 bg-white p-2 outline-none resize text-base rounded shadow-lg"
          style={{
            left: textareaStyle.left,
            top: textareaStyle.top,
            minWidth: textareaStyle.width,
            minHeight: textareaStyle.minHeight,
            fontFamily: textareaStyle.fontFamily,
            fontSize: textareaStyle.fontSize,
            color: textareaStyle.color,
            maxWidth: "400px",
          }}
        />
      )}

      {/* Context menu */}
      {ui.contextMenu && (
        <div className="fixed z-[200] bg-white border rounded-xl shadow-xl py-1 text-sm" style={{ left: ui.contextMenu.x, top: ui.contextMenu.y }} onClick={e => e.stopPropagation()}>
          {ui.contextMenu.elementId ? (
            <>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { clipboardRef.current = elements.filter(el => el.isSelected).map(el => ({ ...el, isSelected: false })); ui.setContextMenu(null); }}>Copy</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { clipboardRef.current = elements.filter(el => el.isSelected && !el.locked).map(el => ({ ...el, isSelected: false })); pushToHistoryWithSync(elements.filter(el => !el.isSelected || el.locked)); ui.setContextMenu(null); }}>Cut</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { duplicateSelected(); ui.setContextMenu(null); }}>Duplicate</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { pushToHistoryWithSync(elements.filter(el => !el.isSelected || el.locked)); ui.setContextMenu(null); }}>Delete</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { toggleLock(); ui.setContextMenu(null); }}>Lock/Unlock</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { bringToFront(); ui.setContextMenu(null); }}>Bring to Front</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { sendToBack(); ui.setContextMenu(null); }}>Send to Back</button>
            </>
          ) : (
            <>
              {connectors.some(c => c.isSelected) && (
                <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left text-rose-600 font-medium border-b border-gray-100" onClick={() => {
                  setConnectors(prev => prev.filter(c => !c.isSelected));
                  ui.setContextMenu(null);
                  toast.success("Deleted connector");
                }}>Delete Connector</button>
              )}
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { pasteElements(); ui.setContextMenu(null); }}>Paste</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { setElements(elements.map(el => ({ ...el, isSelected: true }))); ui.setContextMenu(null); }}>Select All</button>
              <button className="w-full px-4 py-1.5 hover:bg-gray-100 text-left" onClick={() => { ui.setShowGrid(!ui.showGrid); ui.setContextMenu(null); }}>Toggle Grid</button>
            </>
          )}
        </div>
      )}

      {/* Comment popover */}
      {activeCommentId && (
        <div 
          className="fixed z-[200] bg-white border border-gray-200 rounded-lg shadow-2xl p-3 w-64 flex flex-col gap-2"
          style={{
            left: (pan.x + (comments.find(c => c.id === activeCommentId)?.x || 0) * zoom) + 20,
            top: (pan.y + (comments.find(c => c.id === activeCommentId)?.y || 0) * zoom) - 20,
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-gray-700">{comments.find(c => c.id === activeCommentId)?.author}</span>
            <span className="text-[10px] text-gray-400">{new Date(comments.find(c => c.id === activeCommentId)?.timestamp || 0).toLocaleTimeString()}</span>
          </div>
          <textarea
            autoFocus
            className="w-full text-sm outline-none resize-none border-b border-gray-200 focus:border-blue-500 pb-1"
            placeholder="Write a comment..."
            rows={3}
            value={comments.find(c => c.id === activeCommentId)?.text || ""}
            onChange={(e) => {
              const val = e.target.value;
              setComments(prev => prev.map(c => c.id === activeCommentId ? { ...c, text: val } : c));
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") setActiveCommentId(null);
            }}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button 
              className="text-xs font-medium text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
              onClick={() => {
                setComments(prev => prev.filter(c => c.id !== activeCommentId));
                setActiveCommentId(null);
              }}
            >
              Delete
            </button>
            <button 
              className="text-xs font-medium bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
              onClick={() => setActiveCommentId(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main canvas */}
      <div ref={containerRef} className="absolute inset-0 z-0" style={{ touchAction: "none" }}>
        <Canvas
          ref={canvasRef}
          elements={elements}
          connectors={connectors}
          pan={pan}
          zoom={zoom}
          showGrid={ui.showGrid}
          rubberBand={rubberBand}
          bgTheme={bgTheme}
          guides={guides}
          comments={comments}
          defaultTextStyle={defaultTextStyle}
          connectionPreview={connectionPreview}
          editingElementId={editingElementId}
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