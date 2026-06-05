import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Element } from "../lib/types";

/**
 * useSocket — robust socket connection hook for a multi-instance cluster.
 *
 * EVENT API (server -> client)
 * ----------------------------
 *  - init-state          : Element[]   (full board snapshot on join)
 *  - element-created     : Element     (one element added)
 *  - element-updated     : Element     (one element changed)
 *  - element-deleted     : elementId   (one element removed)
 *  - board-state         : Element[]   (full snapshot, used for templates)
 *  - chat-history        : any[]       (chat messages on join)
 *  - chat-message        : any         (one new chat message)
 *  - presence            : { count }   (cluster-wide peer count)
 *  - join-request        : { socketId, user }  (manual approval flow)
 *  - join-accepted       : ()          (manual approval granted)
 *  - join-rejected       : ()          (manual approval denied)
 *  - error               : { code, message }  (terminal errors)
 *
 * CLIENT -> SERVER
 * ----------------------------
 *  - element-create : Element
 *  - element-update : Element
 *  - element-delete : elementId
 *  - board-state    : Element[]   (rare, used after big reset)
 *  - chat-message   : { message: string }
 *  - join-response  : { socketId, accept }
 *
 * Notes
 *  - Reconnect re-runs the auth handshake, so the user is rejoined
 *    automatically and receives an `init-state` after reconnect.
 *  - All `element-*` events are *incremental* — no need to re-send the
 *    full board for every change. This keeps the network and other
 *    clients' React renders cheap.
 */
export const useSocket = (
  SOCKET_URL: string,
  roomId: string | number | null,
  token: string | null,
  onElementsUpdate: (
    elements: Element[] | ((prev: Element[]) => Element[]),
  ) => void,
  onMessagesUpdate?: (messages: any[] | ((prev: any[]) => any[])) => void,
  onJoinRequest?: (req: { socketId: string; user: { id: number; username: string } }) => void,
) => {
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [lastError, setLastError] = useState<null | { code: string; message: string; ts: number }>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    if (!roomId || !token) {
      setSocketConnected(false);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log('🔌 [socket] connecting to', SOCKET_URL, 'roomId=', roomId);
    console.log("hello");
    const socket = io(SOCKET_URL, {
      auth: { roomId, token },
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 15000,
      upgrade: true,
      rememberUpgrade: true,
    });

    socketRef.current = socket;

    // ---------- connection lifecycle ----------
    socket.on("connect", () => {
      console.log("✅ [socket] connected:", socket.id);
      setSocketConnected(true);
      setReconnectAttempt(0);
      setLastError(null);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ [socket] disconnected:", reason);
      setSocketConnected(false);
    });

    socket.io.on("reconnect_attempt", (n) => {
      setReconnectAttempt(n);
    });
    socket.io.on("reconnect", () => {
      setReconnectAttempt(0);
    });
    socket.io.on("reconnect_failed", () => {
      setLastError({
        code: "RECONNECT_FAILED",
        message: "Could not reconnect to the room. Please refresh the page.",
        ts: Date.now(),
      });
    });

    socket.on("error", (error: any) => {
      console.error("❌ [socket] error:", error);
      if (error && typeof error === "object" && error.code) {
        setLastError({ code: error.code, message: error.message || "", ts: Date.now() });
        if (["INVALID_TOKEN", "BAD_HANDSHAKE", "INVALID_ROOM_ID", "ROOM_NOT_FOUND"].includes(error.code)) {
          socket.disconnect();
        }
      } else {
        setSocketConnected(false);
      }
    });

    socket.on("connect_error", (error: Error) => {
      console.error("❌ [socket] connect_error:", error.message);
      setSocketConnected(false);
    });

    // ---------- domain events ----------
    socket.on("presence", ({ count }: { count: number }) => {
      setPeerCount(typeof count === "number" ? count : 1);
    });

    socket.on("init-state", (serverElements: Element[]) => {
      console.log("📦 [socket] init-state:", serverElements?.length ?? 0, "elements");
      onElementsUpdate(serverElements || []);
    });

    socket.on("chat-history", (messages: any[]) => {
      if (onMessagesUpdate) onMessagesUpdate(messages || []);
    });

    socket.on("chat-message", (msg: any) => {
      if (onMessagesUpdate) onMessagesUpdate((prev: any[]) => [...(prev || []), msg]);
    });

    socket.on("join-request", (req: any) => {
      if (onJoinRequest) onJoinRequest(req);
    });

    // INCREMENTAL element events — these are the ones used 99% of the time.
    socket.on("element-created", (newElement: Element) => {
      onElementsUpdate((prev: Element[]) => {
        if (prev.some(el => el.id === newElement.id)) return prev; // de-dupe
        return [...prev, newElement];
      });
    });

    socket.on("element-updated", (updatedElement: Element) => {
      onElementsUpdate((prev: Element[]) =>
        prev.map((el) => (el.id === updatedElement.id ? updatedElement : el)),
      );
    });

    socket.on("element-deleted", (elementId: string) => {
      onElementsUpdate((prev: Element[]) => prev.filter((el) => el.id !== elementId));
    });

    // Full board state (used after template import, etc.)
    socket.on("board-state", (serverElements: Element[]) => {
      onElementsUpdate(serverElements || []);
    });

    return () => {
      console.log('🔌 [socket] cleanup');
      try { socket.disconnect(); } catch (e) { /* ignore */ }
      socket.off();
      socketRef.current = null;
    };
  }, [SOCKET_URL, roomId, token]);

  /**
   * All emit helpers safely no-op when the socket is not connected
   * (so local state still works offline / while connecting).
   */
  const safeEmit = (event: string, ...args: any[]) => {
    const s = socketRef.current;
    if (!s || !s.connected) return;
    s.emit(event, ...args);
  };

  const sendBoardState = (elements: Element[]) => {
    safeEmit("board-state", elements.map((el) => ({ ...el, lastModified: Date.now() })));
  };

  const createElement = (newElement: Element) => {
    safeEmit("element-create", { ...newElement, lastModified: Date.now() });
  };

  const updateElement = (updatedElement: Element) => {
    safeEmit("element-update", { ...updatedElement, lastModified: Date.now() });
  };

  const deleteElement = (elementId: string) => {
    safeEmit("element-delete", elementId);
  };

  const sendChat = (message: string) => {
    safeEmit("chat-message", { message });
  };

  const respondToJoin = (targetSocketId: string, accept: boolean) => {
    safeEmit("join-response", { socketId: targetSocketId, accept });
  };

  const clearError = () => setLastError(null);

  return {
    socketRef,
    socketConnected,
    peerCount,
    sendBoardState,
    createElement,
    updateElement,
    deleteElement,
    sendChat,
    respondToJoin,
    lastError,
    clearError,
    reconnectAttempt,
  };
};