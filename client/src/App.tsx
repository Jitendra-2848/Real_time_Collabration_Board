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
import type { Element, Point, Guide, Comment, Connector, FontDrawStyle, ReshapeHandle, TextElement, TextStyle } from "./lib/types";
import { screenToCanvas, isPointInElement, isPointInElementSolid, distanceToSegment } from "./lib/utils";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

import { useHistory } from "./hooks/useHistory";
import { useUI } from "./hooks/useUI";
import { useDrawingStyle } from "./hooks/useDrawingStyle";
import { useSocket } from "./hooks/useSocket";
import { setApiAuthToken, onApiTokenRefreshed, refreshAccessToken, logoutUser } from "./lib/api";

import * as ExportService from "./services/exportService";
import * as AlignmentService from "./services/alignmentService";
import * as SelectionService from "./services/selectionService";
import * as BoardService from "./services/boardService";
import * as StorageService from "./services/storageService";
import * as ConnectorService from "./services/connectorService";

import { RESIZE_HANDLE_SIZE, EDGE_THRESHOLD } from "./constants/tools";
import { TEMPLATES } from "./constants/templates";

import { handleKeyDown } from "./handlers/keyboardHandlers";
import { getReshapeHandleAtPoint } from "./lib/renderer";
import { handleTextBlur, createTextElement, createStickyNote } from "./handlers/textHandlers";
import { isLongPress } from "./handlers/touchHandlers";
import { 
  createCanvasText, 
  handleTextBlur as handleTextElementBlur,
  isPointInTextElement,
  getTextResizeHandle,
  resizeTextElement
} from "./handlers/textSystem";

export const App = () => {
  const { elements, setElements, pushToHistory, updateElementsFromServer, undo, redo, canUndo, canRedo, history, historyIndex } = useHistory([]);
  const ui = useUI();
  const drawingStyle = useDrawingStyle();

  const [defaultTextStyle, setDefaultTextStyle] = useState<FontDrawStyle>("rough");
  const cycleTextStyle = () => {
    const order: FontDrawStyle[] = ["rough", "clean", "mono"];
    const next = order[(order.indexOf(defaultTextStyle) + 1) % order.length];
    setDefaultTextStyle(next);
  };

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [bgTheme, setBgTheme] = useState<"white" | "light-grid" | "dark" | "dark-grid">("light-grid");

  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  
  // Text elements state
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);
  const [editingTextElementText, setEditingTextElementText] = useState("");
  const [caretIndex, setCaretIndex] = useState(0);



  const startEditingElement = (id: string, text: string) => {
    setEditingElementId(id);
    setEditingText(text);
    originalText.current = text;
    setCaretIndex(text.length);
  };

  const startEditingTextElement = (id: string, text: string) => {
    setEditingTextElementId(id);
    setEditingTextElementText(text);
    originalText.current = text;
    setCaretIndex(text.length);
  };

  const isInteractingWithFormattingBar = useRef(false);

  const getEditingProperties = () => {
    const editingTextElement = textElements.find(el => el.id === editingTextElementId);
    if (editingTextElement) {
      return {
        color: editingTextElement.style.color || "#000000",
        fontSize: editingTextElement.style.fontSize || 16,
        fontFamily: editingTextElement.style.fontFamily || "Inter",
        bold: editingTextElement.style.bold || false,
        italic: editingTextElement.style.italic || false,
        align: editingTextElement.style.align || "left",
        lineHeight: editingTextElement.style.lineHeight || 1.2,
      };
    }
    const editingElement = elements.find(el => el.id === editingElementId);
    if (editingElement) {
      return {
        color: editingElement.color || "#000000",
        fontSize: editingElement.fontSize || 16,
        fontFamily: editingElement.fontFamily || "Inter",
        bold: editingElement.bold || false,
        italic: editingElement.italic || false,
        align: editingElement.textAlign || "left",
        lineHeight: editingElement.lineHeight || 1.2,
      };
    }
    return null;
  };

  const updateEditingProperties = (styleUpdates: Partial<TextStyle>) => {
    if (editingTextElementId) {
      setTextElements(prev => prev.map(el => {
        if (el.id === editingTextElementId) {
          return { ...el, style: { ...el.style, ...styleUpdates } };
        }
        return el;
      }));
    } else if (editingElementId) {
      const elementUpdates: Partial<Element> = {};
      if (styleUpdates.fontSize !== undefined) elementUpdates.fontSize = styleUpdates.fontSize;
      if (styleUpdates.fontFamily !== undefined) elementUpdates.fontFamily = styleUpdates.fontFamily;
      if (styleUpdates.color !== undefined) elementUpdates.color = styleUpdates.color;
      if (styleUpdates.bold !== undefined) elementUpdates.bold = styleUpdates.bold;
      if (styleUpdates.italic !== undefined) elementUpdates.italic = styleUpdates.italic;
      if (styleUpdates.align !== undefined) elementUpdates.textAlign = styleUpdates.align as any;
      if (styleUpdates.lineHeight !== undefined) elementUpdates.lineHeight = styleUpdates.lineHeight;

      const prevEl = elements.find(el => el.id === editingElementId);
      if (prevEl) {
        const nextEl = { ...prevEl, ...elementUpdates };
        setElements(prev => prev.map(el => el.id === editingElementId ? nextEl : el));
        updateElement(nextEl);
      }
    }
  };

  useEffect(() => {
    if (editingElementId || editingTextElementId) {
      const focusInput = () => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.focus();
          const length = hiddenInputRef.current.value.length;
          hiddenInputRef.current.setSelectionRange(length, length);
        }
      };
      focusInput();
      const frame = requestAnimationFrame(focusInput);
      return () => cancelAnimationFrame(frame);
    }
  }, [editingElementId, editingTextElementId]);

  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (!editingElementId && !editingTextElementId) return;

      const target = e.target as HTMLElement;
      const formattingBar = document.getElementById("text-formatting-bar");
      
      // 1. Check if clicked inside formatting bar
      if (formattingBar && (formattingBar === target || formattingBar.contains(target))) {
        isInteractingWithFormattingBar.current = true;
        return;
      }

      // 2. Check if clicked self (the active editing text/shape)
      const canvas = canvasRef.current;
      if (canvas && (canvas === target || canvas.contains(target))) {
        const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
        let clickedSelf = false;
        
        if (editingElementId) {
          const clicked = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
          if (clicked && clicked.id === editingElementId) clickedSelf = true;
        } else if (editingTextElementId) {
          const clicked = [...textElements].reverse().find(el => isPointInTextElement(point.x, point.y, el));
          if (clicked && clicked.id === editingTextElementId) clickedSelf = true;
        }

        if (clickedSelf) {
          isInteractingWithFormattingBar.current = true;
          // refocus textarea in case focus is lost
          setTimeout(() => {
            hiddenInputRef.current?.focus();
          }, 0);
          return;
        }
      }

      // 3. Clicked outside (canvas background, other elements, formatting bar exterior)
      isInteractingWithFormattingBar.current = false;
    };

    document.addEventListener("mousedown", handleDocumentMouseDown, true); // capture phase
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown, true);
  }, [editingElementId, editingTextElementId, elements, textElements, pan, zoom]);

  const clipboardRef = useRef<Element[]>([]);
  const [rubberBand, setRubberBand] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [nextGroupId, setNextGroupId] = useState(1);

  const [guides, setGuides] = useState<Guide[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectionPreview, setConnectionPreview] = useState<{
    sourceId: string; sourceAnchor: string; targetId: string | null; mousePos: Point;
  } | null>(null);
  const [diagramPanelOpen, setDiagramPanelOpen] = useState(false);

  const [boards, setBoards] = useState<BoardService.Board[]>([{ id: "board-1", name: "Board 1", elements: [] }]);
  const [activeBoardId, setActiveBoardId] = useState("board-1");

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [currentRoom, setCurrentRoom] = useState<{ id: string | number; name: string } | null>(null);

  const defaultSocketUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";
  const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || defaultSocketUrl;
  const lastReceivedConnectorsJson = useRef<string>("");
  const lastReceivedCommentsJson = useRef<string>("");
  const lastReceivedTextElementsJson = useRef<string>("");

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
      const textStateElement = resolved.find(el => el.id === "__text_elements_state__");
      if (textStateElement && textStateElement.text) {
        if (textStateElement.text !== lastReceivedTextElementsJson.current) {
          lastReceivedTextElementsJson.current = textStateElement.text;
          try {
            setTextElements(JSON.parse(textStateElement.text));
          } catch (e) {
            console.error("Failed to parse text elements:", e);
          }
        }
      }
      return resolved.filter(el => 
        el.id !== "__connectors_state__" && 
        el.id !== "__comments_state__" && 
        el.id !== "__text_elements_state__"
      );
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
    if (now - lastEmit > 50) {
      updateElement(el);
      throttledUpdateElementRef.current[el.id] = now;
    }
  }, [updateElement]);

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
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const originalText = useRef("");
  const elementsRef = useRef<Element[]>(elements);
  const connectorsRef = useRef<Connector[]>(connectors);
  const actionStartElements = useRef<Element[] | null>(null);

  const lastMousePos = useRef<Point>({ x: 0, y: 0 });
  const reconnectConnectorInfo = useRef<{ connectorId: string; end: "source" | "target" } | null>(null);

  const editingElementIdRef = useRef<string | null>(editingElementId);
  const editingTextElementIdRef = useRef<string | null>(editingTextElementId);
  const textElementsRef = useRef<TextElement[]>(textElements);

  useEffect(() => { activeBoardIdRef.current = activeBoardId; }, [activeBoardId]);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { connectorsRef.current = connectors; }, [connectors]);
  useEffect(() => { editingElementIdRef.current = editingElementId; }, [editingElementId]);
  useEffect(() => { editingTextElementIdRef.current = editingTextElementId; }, [editingTextElementId]);
  useEffect(() => { textElementsRef.current = textElements; }, [textElements]);

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

      const tjson = JSON.stringify(textElements);
      if (tjson !== lastReceivedTextElementsJson.current) {
        lastReceivedTextElementsJson.current = tjson;
        const textStateElement: Element = {
          id: "__text_elements_state__",
          tool: "select" as any,
          x: 0, y: 0, width: 0, height: 0,
          color: "", strokeWidth: 0,
          text: tjson,
        };
        socketRef.current.emit("element-update", textStateElement);
      }
    }
  }, [connectors, comments, textElements, socketConnected, currentRoom]);

  useEffect(() => {
    setElements(boards.find(b => b.id === activeBoardId)?.elements || []);
  }, [activeBoardId]);

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
              localStorage.removeItem('collab-auth');
              localStorage.removeItem('collab-room');
            } else {
              setAuthToken(parsed.token);
              setUser(parsed.user);
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
          prev.fontSize !== el.fontSize ||
          prev.fontFamily !== el.fontFamily ||
          prev.bold !== el.bold ||
          prev.italic !== el.italic ||
          prev.textAlign !== el.textAlign ||
          prev.lineHeight !== el.lineHeight ||
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.className = container.className.replace(/bg-\w+-\d*/g, "");
    container.classList.add(bgTheme.includes("dark") ? "bg-gray-900" : "bg-gray-50");
  }, [bgTheme]);

  const handleAuthSuccess = (user: { id: number; username: string }, token: string) => {
    setUser(user);
    setAuthToken(token);
    localStorage.setItem("collab-auth", JSON.stringify({ user, token }));
  };
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUser(null); setAuthToken(null); setCurrentRoom(null);
    localStorage.removeItem("collab-auth"); localStorage.removeItem("collab-room");
  };

  useEffect(() => {
    setApiAuthToken(authToken);
  }, [authToken]);

  useEffect(() => {
    onApiTokenRefreshed((newToken) => {
      setAuthToken(newToken);
      if (user) {
        localStorage.setItem("collab-auth", JSON.stringify({ user, token: newToken }));
      }
    });
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userIdStr = params.get("userId");
    const username = params.get("username");
    const error = params.get("error");

    if (error) {
      toast.error(`Authentication failed: ${error}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (token && userIdStr && username) {
      const userId = parseInt(userIdStr, 10);
      handleAuthSuccess({ id: userId, username }, token);
      toast.success("Successfully logged in via Google!");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!authToken) return;
    const interval = setInterval(async () => {
      try {
        const result = await refreshAccessToken();
        if (result && result.token) {
          handleAuthSuccess(user || { id: 0, username: "" }, result.token);
        }
      } catch (err) {
        console.error("Auto refresh failed", err);
      }
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(interval);
  }, [authToken, user]);
  const handleJoinRoom = (roomId: string | number, roomName: string) => {
    setCurrentRoom({ id: roomId, name: roomName });
    localStorage.setItem("collab-room", JSON.stringify({ id: roomId, name: roomName }));
  };

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

  const getEdgeAnchors = (el: Element | TextElement): Array<{ x: number; y: number; side: string }> => {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return [
      { x: cx, y: el.y, side: "top" },
      { x: cx, y: el.y + el.height, side: "bottom" },
      { x: el.x, y: cy, side: "left" },
      { x: el.x + el.width, y: cy, side: "right" },
    ];
  };

  const findBestAnchorPair = (source: Element | TextElement, target: Element | TextElement) => {
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

  // Zoom on canvas only
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || ui.presentationMode) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      setZoom(prev => Math.min(Math.max(prev * (1 + delta * 0.08), 0.1), 5));
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [ui.presentationMode]);

  useEffect(() => {
    const handleKeyDownEvent = (e: KeyboardEvent) => {
      if (editingElementId || editingTextElementId) return;
      const action = handleKeyDown(e, ui.presentationMode);
      if (!action) return;
      switch (action.action) {
        case "undo": handleUndo(); break;
        case "redo": handleRedo(); break;
        case "delete-selected": {
          const activeShapeIds = new Set(elements.filter(el => !el.isSelected || el.locked).map(el => el.id));
          const activeTextIds = new Set(textElements.filter(el => !el.isSelected || el.locked).map(el => el.id));
          setConnectors(prev => prev.filter(c => 
            !c.isSelected && 
            (activeShapeIds.has(c.sourceId) || activeTextIds.has(c.sourceId)) && 
            (activeShapeIds.has(c.targetId) || activeTextIds.has(c.targetId))
          ));
          pushToHistoryWithSync(elements.filter(el => !el.isSelected || el.locked));
          setTextElements(prev => prev.filter(el => !el.isSelected || el.locked));
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

  const updateElements = useCallback((id: string, updates: any) => {
    if (elements.some(el => el.id === id)) {
      pushToHistoryWithSync(elements.map(el => (el.id === id ? { ...el, ...updates } : el)));
    } else if (textElements.some(el => el.id === id)) {
      setTextElements(prev => prev.map(el => (el.id === id ? { ...el, ...updates } : el)));
    }
  }, [elements, textElements, pushToHistoryWithSync]);

  const handleAutoAttachConnector = useCallback((sourceEl: Element | TextElement, targetEl: Element | TextElement, customElements?: Element[]) => {
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

    // Also update connectedElementIds for TextElements
    setTextElements(prev => prev.map(el => {
      if (el.id === sourceEl.id || el.id === targetEl.id) {
        const connectedIds = [...(el.connectedElementIds || [])];
        const otherId = el.id === sourceEl.id ? targetEl.id : sourceEl.id;
        if (!connectedIds.includes(otherId)) connectedIds.push(otherId);
        return { ...el, connectedElementIds: connectedIds };
      }
      return el;
    }));
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
    const currentId = editingElementIdRef.current;
    if (!currentId) return;
    // Read live value from DOM to avoid stale closure bug
    const liveText = hiddenInputRef.current?.value ?? editingText;
    const nextElements = handleTextBlur(currentId, liveText, elementsRef.current);
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
  const closeAllPanelsExcept = (exceptName: string) => {
    if (exceptName !== "comments") ui.setCommentsPanelOpen(false);
    if (exceptName !== "layers") ui.setLayersPanelOpen(false);
    if (exceptName !== "properties") ui.setPropertiesPanelOpen(false);
    if (exceptName !== "templates") ui.setTemplatesOpen(false);
    if (exceptName !== "diagram") setDiagramPanelOpen(false);
  };

  const exportPDF = () => {
    if (canvasRef.current) {
      ExportService.exportCanvasToPDF(canvasRef.current);
      toast.success("Board exported as PDF!");
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    actionStartElements.current = elements;
    ui.setContextMenu(null);
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastMousePos.current = { x: e.clientX, y: e.clientY };

    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    const clickedElement = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));

    if (e.detail === 2) {
      if (editingElementId || editingTextElementId) {
        if (editingElementId) handleTextBlurEvent();
        else {
          const nextTextElements = handleTextElementBlur(editingTextElementId!, editingTextElementText, textElements);
          setTextElements(nextTextElements);
          setEditingTextElementId(null);
          setEditingTextElementText("");
        }
      }
      ui.setAction("none"); // Reset any action started by the first click of the double-click gesture!
      if (clickedElement) {
        ui.setSelectedTool('select');
        const otherSelected = elements.filter(el => el.isSelected && el.id !== clickedElement.id);
        if (otherSelected.length > 0) {
          handleAutoAttachConnector(clickedElement, otherSelected[0]);
        }
        startEditingElement(clickedElement.id, clickedElement.text || '');
      } else {
        const id = uuid();
        currentId.current = id;
        const newEl = createTextElement(point, drawingStyle.strokeColor, drawingStyle.opacity);
        newEl.textStyle = defaultTextStyle;
        newEl.resizable = true;
        setElements([...elements, { ...newEl, id }]);
        startEditingElement(id, '');
      }
      return;
    }

    if (editingElementId || editingTextElementId) {
      let clickedSelf = false;
      if (editingElementId) {
        const el = elements.find(el => el.id === editingElementId);
        if (el) {
          const minX = Math.min(el.x, el.x + el.width);
          const maxX = Math.max(el.x, el.x + el.width);
          const minY = Math.min(el.y, el.y + el.height);
          const maxY = Math.max(el.y, el.y + el.height);
          if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
            clickedSelf = true;
          }
        }
      } else if (editingTextElementId) {
        const clicked = [...textElements].reverse().find(el => isPointInTextElement(point.x, point.y, el));
        if (clicked && clicked.id === editingTextElementId) clickedSelf = true;
      }
      
      if (!clickedSelf) {
        // Commit text changes synchronously and exit edit mode, letting the click fall through
        const liveText = hiddenInputRef.current?.value ?? (editingElementId ? editingText : editingTextElementText);
        if (editingElementId) {
          const nextElements = handleTextBlur(editingElementId, liveText, elements);
          setElements(nextElements);
          pushToHistoryWithSync(nextElements);
          setEditingElementId(null);
          setEditingText("");
        } else if (editingTextElementId) {
          const nextTextElements = handleTextElementBlur(editingTextElementId, liveText, textElements);
          setTextElements(nextTextElements);
          setEditingTextElementId(null);
          setEditingTextElementText("");
        }
      } else {
        // Clicked self, consume event, prevent blur and prevent select/drag/resize triggers
        e.preventDefault();
        return;
      }
    }

    if (ui.selectedTool === "hand") { ui.setAction("panning"); return; }
    if (ui.selectedTool === "eraser") {
      ui.setAction("erasing");
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
          keep = !isPointInElementSolid(point.x, point.y, el);
        }
        if (!keep) {
          deletedIds.push(el.id);
        }
        return keep;
      }));
      deletedIds.forEach((id) => deleteElement(id));
      setTextElements((prev) => prev.filter((el) => !isPointInTextElement(point.x, point.y, el)));
      return;
    }
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
      newEl.id = id; // Assign pre-generated ID to prevent sync/autofocus mismatches
      newEl.textStyle = defaultTextStyle;
      newEl.resizable = true;
      setElements([...elements, newEl]);
      startEditingElement(id, "");
      ui.setSelectedTool("select");
      return;
    }
    if (ui.selectedTool === "sticky") {
      pushToHistoryWithSync([...elements, createStickyNote(point, drawingStyle.opacity)]);
      return;
    }
    if (ui.selectedTool === "icon") { ui.setLibraryOpen(true); return; }
    if (ui.selectedTool === "comment") {
      const id = uuid();
      const newComment: Element = {
        id,
        tool: "comment",
        x: point.x - 20,
        y: point.y - 20,
        width: 40,
        height: 40,
        color: "#ca8a04",
        fillColor: "#facc15",
        strokeWidth: 1.5,
        opacity: 1,
        text: "",
        resizable: true,
        author: user?.username || "Guest",
        timestamp: Date.now(),
        resolved: false,
      };
      const nextElements = [...elements, newComment];
      setElements(nextElements);
      pushToHistoryWithSync(nextElements);
      setActiveCommentId(id);
      ui.setSelectedTool("select");
      return;
    }

    if (ui.selectedTool === "arrow") {
      let clickedShape = [...elements].reverse().find(el => isPointInElementSolid(point.x, point.y, el));
      if (!clickedShape) {
        clickedShape = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
      }
      const clickedText = clickedShape ? null : [...textElements].reverse().find(el => isPointInTextElement(point.x, point.y, el));
      const clicked = clickedShape || clickedText;
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

      // Check text element resize handles first
      const selectedTextEls = textElements.filter(el => el.isSelected && !el.locked);
      for (const selectedTextEl of selectedTextEls) {
        const handle = getTextResizeHandle(point.x, point.y, selectedTextEl, zoom);
        if (handle) {
          const isCorner = ["top-left", "top-right", "bottom-left", "bottom-right"].includes(handle);
          if (isCorner) {
            ui.setAction("resizing-text");
            currentId.current = selectedTextEl.id;
            reshapeOrigin.current = { handle: handle as any, startMouse: point, startEl: selectedTextEl as any };
            return;
          } else {
            const newId = uuid();
            connectionOrigin.current = { elementId: selectedTextEl.id, point };
            currentId.current = newId;
            setElements([...elements, {
              id: newId, tool: "arrow" as any, x: point.x, y: point.y, width: 0, height: 0,
              color: drawingStyle.strokeColor, strokeWidth: drawingStyle.strokeWidth,
              opacity: drawingStyle.opacity / 100,
              boundElementIds: { start: selectedTextEl.id, end: null }, resizable: true,
              arrowStyle: "filled",
            }]);
            ui.setAction("connecting");
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

      // Check text element selection
      const clickedTextEl = [...textElements].reverse().find(el => isPointInTextElement(point.x, point.y, el));
      if (clickedTextEl) {
        setConnectors(prev => prev.map(c => ({ ...c, isSelected: false })));
        setElements(elements.map(el => ({ ...el, isSelected: false })));
        setTextElements(textElements.map(el =>
          el.id === clickedTextEl.id
            ? { ...el, isSelected: true }
            : { ...el, isSelected: false }
        ));
        currentId.current = clickedTextEl.id;
        offset.current = { x: point.x - clickedTextEl.x, y: point.y - clickedTextEl.y };
        selectionOrigin.current = { x: clickedTextEl.x, y: clickedTextEl.y };
        ui.setAction("moving-text");
        return;
      }

      let clicked = [...elements].reverse().find(el => isPointInElementSolid(point.x, point.y, el));
      if (!clicked) {
        clicked = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
      }
      if (clicked) {
        if (clicked.tool === "comment") {
          setActiveCommentId(clicked.id);
        } else {
          setActiveCommentId(null);
        }
        setConnectors(prev => prev.map(c => ({ ...c, isSelected: false })));
        setTextElements(textElements.map(el => ({ ...el, isSelected: false })));
        const shift = e.shiftKey;
        const nextElements = elements.map(el =>
          el.id === clicked!.id
            ? { ...el, isSelected: shift ? !el.isSelected : true }
            : shift ? el : { ...el, isSelected: false }
        );
        setElements(nextElements);
        currentId.current = clicked.id;
        offset.current = { x: point.x - clicked.x, y: point.y - clicked.y };
        selectionOrigin.current = { x: clicked.x, y: clicked.y };
        ui.setAction("moving");
        return;
      }

      const clickedConnector = [...connectors].reverse().find(c => {
        const sourceEl = elements.find(el => el.id === c.sourceId) || textElements.find(el => el.id === c.sourceId);
        const targetEl = elements.find(el => el.id === c.targetId) || textElements.find(el => el.id === c.targetId);
        if (!sourceEl || !targetEl) return false;
        return ConnectorService.isPointNearConnector(point.x, point.y, c, elements, textElements, 10 / zoom);
      });

      if (clickedConnector) {
        setActiveCommentId(null);
        setElements(elements.map(el => ({ ...el, isSelected: false })));
        setConnectors(prev => prev.map(c => ({ ...c, isSelected: c.id === clickedConnector.id })));
        return;
      }

      setActiveCommentId(null);
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

    const screenDeltaX = e.clientX - lastMousePos.current.x;
    const screenDeltaY = e.clientY - lastMousePos.current.y;
    const canvasDeltaX = screenDeltaX / zoom;
    const canvasDeltaY = screenDeltaY / zoom;

    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (ui.action === "panning") {
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
    } else if (ui.action === "moving-text" && currentId.current) {
      setTextElements(prev =>
        prev.map(el => {
          if (el.id !== currentId.current) return el;
          return {
            ...el,
            x: el.x + canvasDeltaX,
            y: el.y + canvasDeltaY,
          };
        })
      );
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
          keep = !isPointInElementSolid(point.x, point.y, el);
        }
        if (!keep) {
          deletedIds.push(el.id);
        }
        return keep;
      }));
      deletedIds.forEach((id) => deleteElement(id));
      setTextElements((prev) => prev.filter((el) => !isPointInTextElement(point.x, point.y, el)));
    } else if (ui.action === "resizing" && currentId.current) {
      let updatedEl: Element | null = null;
      if (reshapeOrigin.current) {
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
    } else if (ui.action === "resizing-text" && currentId.current && reshapeOrigin.current) {
      const delta = {
        x: point.x - reshapeOrigin.current.startMouse.x,
        y: point.y - reshapeOrigin.current.startMouse.y
      };
      setTextElements(prev =>
        prev.map(el => {
          if (el.id !== currentId.current) return el;
          return resizeTextElement(reshapeOrigin.current!.startEl as any, reshapeOrigin.current!.handle, delta.x, delta.y);
        })
      );
    } else if (ui.action === "connecting" && currentId.current) {
      let hoveredShape = [...elements].reverse().find((el) =>
        el.id !== currentId.current &&
        el.id !== connectionOrigin.current?.elementId &&
        isPointInElementSolid(point.x, point.y, el)
      );
      if (!hoveredShape) {
        hoveredShape = [...elements].reverse().find((el) =>
          el.id !== currentId.current &&
          el.id !== connectionOrigin.current?.elementId &&
          isPointInElement(point.x, point.y, el)
        );
      }
      const hoveredText = hoveredShape ? null : [...textElements].reverse().find((el) =>
        el.id !== currentId.current &&
        el.id !== connectionOrigin.current?.elementId &&
        isPointInTextElement(point.x, point.y, el)
      );
      const hovered = hoveredShape || hoveredText;
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
        const bounds = hovered ? getElementBoundsLocal(hovered as any) : null;
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
        const hoveredShape = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
        const hoveredText = hoveredShape ? null : [...textElements].reverse().find(el => isPointInTextElement(point.x, point.y, el));
        const hovered = hoveredShape || hoveredText;
        if (end === "target") {
          const sourceEl = elements.find(el => el.id === conn.sourceId) || textElements.find(el => el.id === conn.sourceId);
          if (sourceEl) {
            setConnectionPreview({
              sourceId: conn.sourceId,
              sourceAnchor: "center",
              targetId: hovered?.id || null,
              mousePos: point
            });
          }
        } else {
          const targetEl = elements.find(el => el.id === conn.targetId) || textElements.find(el => el.id === conn.targetId);
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
            const hoveredShape = [...elements].reverse().find(el => isPointInElement(point.x, point.y, el));
            const hoveredText = hoveredShape ? null : [...textElements].reverse().find(el => isPointInTextElement(point.x, point.y, el));
            const hovered = hoveredShape || hoveredText;
            if (hovered && hovered.id !== (end === "source" ? conn.targetId : conn.sourceId)) {
              setConnectors(prev => prev.map(c => {
                if (c.id === connectorId) {
                  const updated = { ...c };
                  if (end === "source") {
                    updated.sourceId = hovered.id;
                  } else {
                    updated.targetId = hovered.id;
                  }
                  const sourceEl = elements.find(el => el.id === updated.sourceId) || textElements.find(el => el.id === updated.sourceId);
                  const targetEl = elements.find(el => el.id === updated.targetId) || textElements.find(el => el.id === updated.targetId);
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
          const targetEl = nextElements.find(el => el.id === endId) || textElements.find(el => el.id === endId);
          const sourceEl = nextElements.find(el => el.id === connectionOrigin.current!.elementId) || textElements.find(el => el.id === connectionOrigin.current!.elementId);
          if (sourceEl && targetEl) {
            handleAutoAttachConnector(sourceEl as any, targetEl as any, nextElements);
            didConnect = true;
          }
        }
      }

      if (["drawing", "moving", "moving-text", "resizing", "resizing-text", "connecting", "erasing"].includes(ui.action)) {
        setConnectors(prev => ConnectorService.refreshAllConnectors(prev, nextElements, textElements));
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);
    
    // Check text elements first (topmost)
    const clickedTextEl = [...textElements].reverse().find(el => isPointInTextElement(point.x, point.y, el));
    if (clickedTextEl) {
      startEditingTextElement(clickedTextEl.id, clickedTextEl.text || '');
      return;
    }
    
    // Check regular elements
    const clickedElement = [...elements].reverse().find(el => isPointInElementSolid(point.x, point.y, el));
    if (clickedElement) {
      if (editingElementId || editingTextElementId) {
        if (editingElementId) handleTextBlurEvent();
        else {
          const nextTextElements = handleTextElementBlur(editingTextElementId!, editingTextElementText, textElements);
          setTextElements(nextTextElements);
          setEditingTextElementId(null);
          setEditingTextElementText("");
        }
      }
      ui.setSelectedTool('select');
      const otherSelected = elements.filter(el => el.isSelected && el.id !== clickedElement.id);
      if (otherSelected.length > 0) {
        handleAutoAttachConnector(clickedElement, otherSelected[0]);
      }
      startEditingElement(clickedElement.id, clickedElement.text || '');
    } else {
      if (editingElementId || editingTextElementId) {
        if (editingElementId) handleTextBlurEvent();
        else {
          const nextTextElements = handleTextElementBlur(editingTextElementId!, editingTextElementText, textElements);
          setTextElements(nextTextElements);
          setEditingTextElementId(null);
          setEditingTextElementText("");
        }
      }
      // Create new canvas text on double-click empty space
      const newTextEl = createCanvasText(point, drawingStyle.strokeColor, drawingStyle.opacity, defaultTextStyle);
      setTextElements(prev => [...prev, newTextEl]);
      startEditingTextElement(newTextEl.id, '');
    }
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

      {/* Room Info - responsive positioning */}
      <div className="hidden sm:block">
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
      </div>

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
        onToggleComments={() => { const target = !ui.commentsPanelOpen; closeAllPanelsExcept("comments"); ui.setCommentsPanelOpen(target); }}
        onToggleLayers={() => { const target = !ui.layersPanelOpen; closeAllPanelsExcept("layers"); ui.setLayersPanelOpen(target); }}
        onToggleProperties={() => { const target = !ui.propertiesPanelOpen; closeAllPanelsExcept("properties"); ui.setPropertiesPanelOpen(target); }}
        onToggleTemplates={() => { const target = !ui.templatesOpen; closeAllPanelsExcept("templates"); ui.setTemplatesOpen(target); }}
        onToggleDiagramEditor={() => { const target = !diagramPanelOpen; closeAllPanelsExcept("diagram"); setDiagramPanelOpen(target); }}
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

      {/* Realtime Status Indicator - responsive positioning */}
      <div className="sm:hidden">
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
      </div>

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
      {ui.propertiesPanelOpen && (getSelected() || textElements.find(el => el.isSelected)) && (
        <PropertiesPanel
          selectedElement={getSelected() || textElements.find(el => el.isSelected)}
          onUpdateElement={updateElements}
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

      {/* Minimap */}
      {ui.showMinimap && (
        <div className="fixed bottom-16 right-4 z-30 w-48 h-36 bg-white border rounded-lg shadow-lg overflow-hidden">
          <Minimap elements={elements} pan={pan} zoom={zoom} />
        </div>
      )}

      {/* Hidden input/textarea for canvas-native text entry */}
      {(editingElementId || editingTextElementId) && (
        <textarea
          ref={hiddenInputRef}
          autoFocus
          value={editingElementId ? editingText : editingTextElementText}
          onChange={e => {
            if ((window as any).lastInputTime === undefined || (window as any).lastInputTime === null) {
              (window as any).lastInputTime = performance.now();
            }
            const val = e.target.value;
            if (editingElementId) {
              setEditingText(val);
            } else if (editingTextElementId) {
              setEditingTextElementText(val);
            }
            setCaretIndex(e.target.selectionStart || 0);
          }}
          onSelect={e => {
            setCaretIndex((e.target as HTMLTextAreaElement).selectionStart || 0);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (isInteractingWithFormattingBar.current) {
                hiddenInputRef.current?.focus();
                isInteractingWithFormattingBar.current = false;
                return;
              }
              // Read live DOM value to avoid stale closure bug
              const liveText = hiddenInputRef.current?.value ?? "";
              const currentEditingElementId = editingElementIdRef.current;
              const currentEditingTextElementId = editingTextElementIdRef.current;
              
              if (!currentEditingElementId && !currentEditingTextElementId) {
                // Already committed by handleMouseDown or Escape! Do nothing.
                return;
              }

              if (currentEditingElementId) {
                const nextElements = handleTextBlur(currentEditingElementId, liveText, elementsRef.current);
                pushToHistoryWithSync(nextElements);
                setEditingElementId(null);
                setEditingText("");
              } else if (currentEditingTextElementId) {
                const nextTextElements = handleTextElementBlur(currentEditingTextElementId, liveText, textElementsRef.current);
                setTextElements(nextTextElements);
                setEditingTextElementId(null);
                setEditingTextElementText("");
              }
            }, 150);
          }}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              if (hiddenInputRef.current) {
                hiddenInputRef.current.value = originalText.current;
              }
              if (editingElementId) {
                setEditingText(originalText.current);
              } else if (editingTextElementId) {
                setEditingTextElementText(originalText.current);
              }
              hiddenInputRef.current?.blur();
            }
          }}
          style={{
            position: "absolute",
            opacity: 0,
            left: "-9999px",
            top: "-9999px",
            width: "0px",
            height: "0px",
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
      )}

      {/* Floating Text Formatting Bar */}
      {(editingElementId || editingTextElementId) && (() => {
        const props = getEditingProperties();
        if (!props) return null;
        return (
          <div 
            id="text-formatting-bar"
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[400] bg-white/95 border border-slate-200/80 shadow-2xl rounded-2xl p-2.5 px-4 flex items-center gap-3 backdrop-blur-md transition-all duration-300 hover:shadow-3xl"
            onMouseDown={() => {
              isInteractingWithFormattingBar.current = true;
            }}
            onMouseLeave={() => {
              isInteractingWithFormattingBar.current = false;
            }}
          >
            {/* Font Family Dropdown */}
            <select
              value={props.fontFamily}
              onMouseDown={() => {
                isInteractingWithFormattingBar.current = true;
              }}
              onChange={(e) => {
                isInteractingWithFormattingBar.current = true;
                updateEditingProperties({ fontFamily: e.target.value });
                setTimeout(() => {
                  hiddenInputRef.current?.focus();
                  isInteractingWithFormattingBar.current = false;
                }, 50);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:border-slate-400 font-semibold text-slate-700 cursor-pointer"
            >
              <option value="Inter">Inter (Sans)</option>
              <option value="Caveat">Caveat (Handwriting)</option>
              <option value="monospace">Monospace</option>
              <option value="Georgia">Georgia (Serif)</option>
              <option value="Courier New">Courier</option>
            </select>

            <div className="h-5 w-[1px] bg-slate-200" />

            {/* Font Size Input */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Size</span>
              <input
                type="number"
                value={props.fontSize}
                onMouseDown={() => {
                  isInteractingWithFormattingBar.current = true;
                }}
                onChange={(e) => {
                  isInteractingWithFormattingBar.current = true;
                  updateEditingProperties({ fontSize: Number(e.target.value) });
                }}
                onBlur={() => {
                  setTimeout(() => {
                    hiddenInputRef.current?.focus();
                  }, 50);
                }}
                className="w-12 border border-slate-200 rounded-xl px-2 py-1.5 focus:border-slate-400 focus:outline-none text-xs font-semibold text-slate-700 bg-slate-50/50 text-center"
                min={8}
                max={120}
              />
            </div>

            <div className="h-5 w-[1px] bg-slate-200" />

            {/* Bold Toggle */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateEditingProperties({ bold: !props.bold })}
              className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                props.bold
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Bold"
            >
              <Bold size={16} />
            </button>

            {/* Italic Toggle */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateEditingProperties({ italic: !props.italic })}
              className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                props.italic
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Italic"
            >
              <Italic size={16} />
            </button>

            <div className="h-5 w-[1px] bg-slate-200" />

            {/* Alignments */}
            <div className="flex items-center gap-0.5">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateEditingProperties({ align: "left" })}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                  props.align === "left"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title="Align Left"
              >
                <AlignLeft size={16} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateEditingProperties({ align: "center" })}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                  props.align === "center"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title="Align Center"
              >
                <AlignCenter size={16} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateEditingProperties({ align: "right" })}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                  props.align === "right"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title="Align Right"
              >
                <AlignRight size={16} />
              </button>
            </div>

            <div className="h-5 w-[1px] bg-slate-200" />

            {/* Color Selector */}
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={props.color}
                onMouseDown={() => {
                  isInteractingWithFormattingBar.current = true;
                }}
                onChange={(e) => {
                  isInteractingWithFormattingBar.current = true;
                  updateEditingProperties({ color: e.target.value });
                  setTimeout(() => {
                    hiddenInputRef.current?.focus();
                    isInteractingWithFormattingBar.current = false;
                  }, 50);
                }}
                className="w-7 h-7 border border-slate-200 rounded-lg cursor-pointer p-0 bg-white"
                title="Text Color"
              />
            </div>
          </div>
        );
      })()}

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
      {activeCommentId && (() => {
        const activeCommentEl = elements.find(el => el.id === activeCommentId);
        const activeLegacyComment = comments.find(c => c.id === activeCommentId);
        const commentX = activeCommentEl ? activeCommentEl.x + activeCommentEl.width / 2 : (activeLegacyComment?.x || 0);
        const commentY = activeCommentEl ? activeCommentEl.y + activeCommentEl.height / 2 : (activeLegacyComment?.y || 0);
        const commentAuthor = activeCommentEl?.author || activeLegacyComment?.author || "Guest";
        const commentTime = activeCommentEl?.timestamp || activeLegacyComment?.timestamp || Date.now();
        const commentText = activeCommentEl?.text || activeLegacyComment?.text || "";

        return (
          <div 
            className="fixed z-[200] bg-white border border-gray-200 rounded-lg shadow-2xl p-3 w-64 flex flex-col gap-2"
            style={{
              left: (pan.x + commentX * zoom) + 20,
              top: (pan.y + commentY * zoom) - 20,
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-gray-700">{commentAuthor}</span>
              <span className="text-[10px] text-gray-400">{new Date(commentTime).toLocaleTimeString()}</span>
            </div>
            <textarea
              autoFocus
              className="w-full text-sm outline-none resize-none border-b border-gray-200 focus:border-blue-500 pb-1"
              placeholder="Write a comment..."
              rows={3}
              value={commentText}
              onChange={(e) => {
                const val = e.target.value;
                if (activeCommentEl) {
                  const updated = elements.map(el => el.id === activeCommentId ? { ...el, text: val } : el);
                  setElements(updated);
                  throttledUpdateElement(updated.find(el => el.id === activeCommentId)!);
                } else {
                  setComments(prev => prev.map(c => c.id === activeCommentId ? { ...c, text: val } : c));
                }
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
                  if (activeCommentEl) {
                    const nextElements = elements.filter(el => el.id !== activeCommentId);
                    setElements(nextElements);
                    pushToHistoryWithSync(nextElements);
                  } else {
                    setComments(prev => prev.filter(c => c.id !== activeCommentId));
                  }
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
        );
      })()}

      {/* Main canvas */}
      <div ref={containerRef} className="absolute inset-0 z-0" style={{ touchAction: "none" }}>
        <Canvas
          ref={canvasRef}
          elements={elements}
          connectors={connectors}
          textElements={textElements}
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
          editingTextElementId={editingTextElementId}
          editingText={editingText}
          editingTextElementText={editingTextElementText}
          caretIndex={caretIndex}
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