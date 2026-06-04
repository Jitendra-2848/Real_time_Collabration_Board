import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Element } from "../lib/types";

export const useSocket = (
  SOCKET_URL: string,
  roomId: number | null,
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

  useEffect(() => {
    if (!roomId || !token) {
      setSocketConnected(false);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { roomId, token },
    });

    socketRef.current = socket;

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("presence", ({ count }: { count: number }) =>
      setPeerCount(count),
    );

    socket.on("init-state", (serverElements: Element[]) => {
      onElementsUpdate(serverElements);
    });

    socket.on('chat-history', (messages: any[]) => {
      if (onMessagesUpdate) onMessagesUpdate(messages);
    });

    socket.on('chat-message', (msg: any) => {
      if (onMessagesUpdate) onMessagesUpdate((prev: any[]) => [...(prev || []), msg]);
    });

    socket.on('join-request', (req: any) => {
      if (onJoinRequest) onJoinRequest(req);
    });

    socket.on("element-created", (newElement: Element) => {
      onElementsUpdate((prev: Element[]) => [...prev, newElement]);
    });

    socket.on("element-updated", (updatedElement: Element) => {
      onElementsUpdate((prev: Element[]) =>
        prev.map((el) => (el.id === updatedElement.id ? updatedElement : el)),
      );
    });

    socket.on("element-deleted", (elementId: string) => {
      onElementsUpdate((prev: Element[]) =>
        prev.filter((el) => el.id !== elementId),
      );
    });

    socket.on("board-state", (serverElements: Element[]) => {
      onElementsUpdate(serverElements);
    });

    socket.on("connect_error", (error: Error) => {
      console.error("Socket connect error:", error.message);
    });

    return () => {
      // socket.disconnect();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("presence");
      socket.off("init-state");
      socket.off("element-created");
      socket.off("element-updated");
      socket.off("element-deleted");
      socket.off("board-state");
      socketRef.current = null;
    };
  }, [SOCKET_URL, roomId, token]);

  const sendBoardState = (elements: Element[]) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit(
      "board-state",
      elements.map((el) => ({ ...el, lastModified: Date.now() })),
    );
  };

  const createElement = (newElement: Element) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("element-create", {
      ...newElement,
      lastModified: Date.now(),
    });
  };

  const updateElement = (updatedElement: Element) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("element-update", {
      ...updatedElement,
      lastModified: Date.now(),
    });
  };

  const deleteElement = (elementId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("element-delete", elementId);
  };

  const sendChat = (message: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('chat-message', { message });
  };

  return {
    socketRef,
    socketConnected,
    peerCount,
    sendBoardState,
    createElement,
    updateElement,
    deleteElement,
    sendChat,
  };
};
