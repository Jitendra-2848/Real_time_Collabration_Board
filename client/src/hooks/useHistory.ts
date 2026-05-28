import { useEffect, useState } from "react";
import type { Element } from "../lib/types";

export const useHistory = (initialElements: Element[]) => {
  const [history, setHistory] = useState<Element[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [elements, setElements] = useState(initialElements);

  const pushToHistory = (newElements: Element[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(newElements);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
    }
  };

  const clear = () => {
    pushToHistory([]);
  };

  return {
    elements,
    setElements,
    history,
    historyIndex,
    pushToHistory,
    undo,
    redo,
    clear,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
};
