import { useState } from "react";
import type { Element } from "../lib/types";

export const useHistory = (initialElements: Element[]) => {
  const [history, setHistory] = useState<Element[][]>([initialElements]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [elements, _setElements] = useState(initialElements);

  const setElements = (val: Element[] | ((prev: Element[]) => Element[])) => {
    _setElements(prev => {
      const nextElements = typeof val === "function" ? val(prev) : val;
      setHistory(prevHistory => {
        const nextHistory = [...prevHistory];
        nextHistory[historyIndex] = nextElements;
        return nextHistory;
      });
      return nextElements;
    });
  };

  const pushToHistory = (newElements: Element[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    _setElements(newElements);
  };

  const updateElementsFromServer = (val: Element[] | ((prev: Element[]) => Element[])) => {
    if (typeof val === "function") {
      _setElements(prev => {
        const nextElements = val(prev);
        setHistory(prevHistory => prevHistory.map(snapshot => val(snapshot)));
        return nextElements;
      });
    } else {
      setHistory([val]);
      setHistoryIndex(0);
      _setElements(val);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      _setElements(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      _setElements(history[historyIndex + 1]);
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
    updateElementsFromServer,
    undo,
    redo,
    clear,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
};
