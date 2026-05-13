import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { Canvas } from "./components/Canvas";
import { ToolSidebar } from "./components/ToolSidebar";
import { TopBar } from "./components/TopBar";
import { IconLibrary } from "./components/IconLibrary";
import type { Element, Point, Tool } from "./lib/types";
import {
  getBoundingBox,
  getResizeHandles,
  isPointInElement,
  isPointInHandle,
  normalizeElement,
  screenToCanvas,
} from "./lib/utils";

type Action =
  | "none"
  | "drawing"
  | "moving"
  | "panning"
  | "erasing"
  | "soft-erasing"
  | "resizing"
  | "curving-arrow";

const App = () => {
  const [elements, setElements] = useState<Element[]>([]);
  const [history, setHistory] = useState<Element[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [action, setAction] = useState<Action>("none");

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);

  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [fillEnabled, setFillEnabled] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);

  const [isLibraryOpen, setLibraryOpen] = useState(false);

  const [canvasSize, setCanvasSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentId = useRef<string | null>(null);
  const offset = useRef<Point>({ x: 0, y: 0 });

  const resizeHandleRef = useRef<string | null>(null);
  const resizeOriginalRef = useRef<Element | null>(null);

  const [textInput, setTextInput] = useState<{
    active: boolean;
    value: string;
    pos: Point;
    targetId: string | null;
  }>({
    active: false,
    value: "",
    pos: { x: 0, y: 0 },
    targetId: null,
  });

  const canvasCallbackRef = useCallback((node: HTMLCanvasElement | null) => {
    if (node) canvasRef.current = node;
  }, []);

  const pushToHistory = (newElements: Element[]) => {
    const normalized = newElements.map(normalizeElement);
    const newHistory = history.slice(0, historyIndex + 1);

    newHistory.push(normalized);

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(normalized);
  };

  useEffect(() => {
    const onResize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  /**
   * Important:
   * This stops browser/page zoom when using touchpad pinch or ctrl+wheel.
   * Canvas zoom will still work from handleWheel.
   */
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", preventBrowserZoom, { passive: false });

    return () => {
      window.removeEventListener("wheel", preventBrowserZoom);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (textInput.active) {
        if (e.key === "Escape") {
          setTextInput({
            active: false,
            value: "",
            pos: { x: 0, y: 0 },
            targetId: null,
          });
        }

        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();

        if (e.shiftKey) redo();
        else undo();

        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (e.ctrlKey || e.metaKey) return;

      const keyMap: Record<string, Tool> = {
        v: "select",
        h: "hand",
        p: "pen",
        r: "rect",
        c: "circle",
        d: "diamond",
        a: "arrow",
        l: "line",
        t: "text",
        e: "eraser",
        s: "soft-eraser",
      };

      const nextTool = keyMap[e.key.toLowerCase()];

      if (nextTool) {
        setSelectedTool(nextTool);
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const newElements = elements.filter((el) => !el.isSelected);
        pushToHistory(newElements);
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [elements, history, historyIndex, textInput.active]);

  const finalizeTextInput = () => {
    const value = textInput.value.trim();

    if (textInput.targetId) {
      const newElements = elements.map((el) =>
        el.id === textInput.targetId
          ? {
              ...el,
              text: value || undefined,
            }
          : el
      );

      pushToHistory(newElements);
    } else if (value) {
      const newText: Element = {
        id: uuid(),
        tool: "text",
        x: textInput.pos.x,
        y: textInput.pos.y,
        width: 160,
        height: 30,
        color: strokeColor,
        strokeWidth,
        text: value,
      };

      pushToHistory([...elements, newText]);
    }

    setTextInput({
      active: false,
      value: "",
      pos: { x: 0, y: 0 },
      targetId: null,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);

    if (textInput.active) {
      finalizeTextInput();
      return;
    }

    if (selectedTool === "hand") {
      setAction("panning");
      return;
    }

    if (selectedTool === "eraser") {
      setAction("erasing");
      return;
    }

    if (selectedTool === "soft-eraser") {
      setAction("soft-erasing");
      return;
    }

    if (selectedTool === "text") {
      const clickedElement = [...elements]
        .reverse()
        .find((el) => isPointInElement(point.x, point.y, el));

      if (
        clickedElement &&
        ["rect", "circle", "diamond"].includes(clickedElement.tool)
      ) {
        setTextInput({
          active: true,
          value: clickedElement.text || "",
          pos: {
            x: clickedElement.x + 10,
            y: clickedElement.y + 10,
          },
          targetId: clickedElement.id,
        });
      } else {
        setTextInput({
          active: true,
          value: "",
          pos: point,
          targetId: null,
        });
      }

      return;
    }

    if (selectedTool === "select") {
      const selected = elements.find((el) => el.isSelected);

      if (selected) {
        const handles = getResizeHandles(selected, zoom);

        const handleEntry = Object.entries(handles).find(([_, handle]) =>
          isPointInHandle(point.x, point.y, handle)
        );

        if (handleEntry) {
          const [handleName] = handleEntry;

          currentId.current = selected.id;

          if (selected.tool === "arrow" && handleName === "middle") {
            setAction("curving-arrow");
            return;
          }

          resizeHandleRef.current = handleName;
          resizeOriginalRef.current = { ...selected };
          setAction("resizing");

          return;
        }
      }

      const clickedElement = [...elements]
        .reverse()
        .find((el) => isPointInElement(point.x, point.y, el));

      if (clickedElement) {
        const newElements = elements.map((el) => ({
          ...el,
          isSelected: el.id === clickedElement.id,
        }));

        setElements(newElements);

        currentId.current = clickedElement.id;

        const box = getBoundingBox(clickedElement);

        offset.current = {
          x: point.x - box.x,
          y: point.y - box.y,
        };

        setAction("moving");
      } else {
        setElements((prev) => prev.map((el) => ({ ...el, isSelected: false })));
      }

      return;
    }

    const id = uuid();
    currentId.current = id;

    const newElement: Element = {
      id,
      tool: selectedTool,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      color: strokeColor,
      fillColor:
        fillEnabled &&
        selectedTool !== "pen" &&
        selectedTool !== "line" &&
        selectedTool !== "arrow"
          ? fillColor
          : undefined,
      strokeWidth,
      points: selectedTool === "pen" ? [point] : undefined,
      curveOffset: selectedTool === "arrow" ? 0 : undefined,
    };

    setElements((prev) => [...prev, newElement]);
    setAction("drawing");
  };

  const resizeElement = (
    original: Element,
    handle: string,
    point: Point
  ): Element => {
    if (original.tool === "arrow" || original.tool === "line") {
      const endX = original.x + original.width;
      const endY = original.y + original.height;

      if (handle === "start") {
        return {
          ...original,
          x: point.x,
          y: point.y,
          width: endX - point.x,
          height: endY - point.y,
        };
      }

      if (handle === "end") {
        return {
          ...original,
          width: point.x - original.x,
          height: point.y - original.y,
        };
      }

      return original;
    }

    const box = getBoundingBox(original);

    let x = box.x;
    let y = box.y;
    let width = box.width;
    let height = box.height;

    if (handle.includes("e")) {
      width = point.x - box.x;
    }

    if (handle.includes("w")) {
      width = box.x + box.width - point.x;
      x = point.x;
    }

    if (handle.includes("s")) {
      height = point.y - box.y;
    }

    if (handle.includes("n")) {
      height = box.y + box.height - point.y;
      y = point.y;
    }

    width = Math.max(width, 5);
    height = Math.max(height, 5);

    if (original.tool === "pen" && original.points) {
      const oldBox = getBoundingBox(original);

      const scaleX = width / Math.max(oldBox.width, 1);
      const scaleY = height / Math.max(oldBox.height, 1);

      return {
        ...original,
        x,
        y,
        width,
        height,
        points: original.points.map((p) => ({
          x: x + (p.x - oldBox.x) * scaleX,
          y: y + (p.y - oldBox.y) * scaleY,
        })),
      };
    }

    return {
      ...original,
      x,
      y,
      width,
      height,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);

    if (action === "panning") {
      setPan((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));

      return;
    }

    if (action === "drawing") {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== currentId.current) return el;

          if (el.tool === "pen") {
            return {
              ...el,
              points: [...(el.points || []), point],
            };
          }

          return {
            ...el,
            width: point.x - el.x,
            height: point.y - el.y,
          };
        })
      );

      return;
    }

    if (action === "moving") {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== currentId.current) return el;

          const box = getBoundingBox(el);

          const newX = point.x - offset.current.x;
          const newY = point.y - offset.current.y;

          const dx = newX - box.x;
          const dy = newY - box.y;

          if (el.tool === "pen" && el.points) {
            return {
              ...el,
              x: el.x + dx,
              y: el.y + dy,
              points: el.points.map((p) => ({
                x: p.x + dx,
                y: p.y + dy,
              })),
            };
          }

          if (el.tool === "arrow" || el.tool === "line") {
            return {
              ...el,
              x: el.x + dx,
              y: el.y + dy,
            };
          }

          return {
            ...el,
            x: newX,
            y: newY,
          };
        })
      );

      return;
    }

    if (action === "resizing") {
      const original = resizeOriginalRef.current;
      const handle = resizeHandleRef.current;

      if (!original || !handle) return;

      setElements((prev) =>
        prev.map((el) =>
          el.id === currentId.current ? resizeElement(original, handle, point) : el
        )
      );

      return;
    }

    if (action === "curving-arrow") {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== currentId.current || el.tool !== "arrow") return el;

          const x1 = el.x;
          const y1 = el.y;
          const x2 = el.x + el.width;
          const y2 = el.y + el.height;

          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          const angle = Math.atan2(y2 - y1, x2 - x1);
          const perp = angle + Math.PI / 2;

          const dx = point.x - midX;
          const dy = point.y - midY;

          const curveOffset = dx * Math.cos(perp) + dy * Math.sin(perp);

          return {
            ...el,
            curveOffset,
          };
        })
      );

      return;
    }

    if (action === "erasing") {
      setElements((prev) =>
        prev.filter((el) => !isPointInElement(point.x, point.y, el))
      );

      return;
    }

    if (action === "soft-erasing") {
      setElements((prev) =>
        prev
          .map((el) => {
            if (el.tool !== "pen" || !el.points) return el;

            const radius = 18 / zoom;

            const remaining = el.points.filter(
              (p) => Math.hypot(p.x - point.x, p.y - point.y) > radius
            );

            if (remaining.length < 3) return null;

            return {
              ...el,
              points: remaining,
            };
          })
          .filter(Boolean) as Element[]
      );
    }
  };

  const handleMouseUp = () => {
    if (
      action === "drawing" ||
      action === "moving" ||
      action === "resizing" ||
      action === "curving-arrow"
    ) {
      const cleaned = elements
        .filter((el) => {
          if (el.tool === "pen") return el.points && el.points.length > 2;
          if (el.tool === "arrow" || el.tool === "line") {
            return Math.abs(el.width) > 5 || Math.abs(el.height) > 5;
          }

          return Math.abs(el.width) > 5 || Math.abs(el.height) > 5 || el.tool === "text";
        })
        .map(normalizeElement);

      pushToHistory(cleaned);
    }

    setAction("none");
    currentId.current = null;
    resizeHandleRef.current = null;
    resizeOriginalRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const before = screenToCanvas(e.clientX, e.clientY, canvas, pan, zoom);

      const factor = Math.exp(-e.deltaY * 0.001);
      const nextZoom = Math.min(Math.max(zoom * factor, 0.25), 4);

      const after = screenToCanvas(e.clientX, e.clientY, canvas, pan, nextZoom);

      setZoom(nextZoom);

      setPan((prev) => ({
        x: prev.x + (after.x - before.x) * nextZoom,
        y: prev.y + (after.y - before.y) * nextZoom,
      }));

      return;
    }

    setPan((prev) => ({
      x: prev.x - e.deltaX * 0.7,
      y: prev.y - e.deltaY * 0.7,
    }));
  };

  const undo = () => {
    if (historyIndex <= 0) return;

    const nextIndex = historyIndex - 1;

    setHistoryIndex(nextIndex);
    setElements(history[nextIndex]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;

    const nextIndex = historyIndex + 1;

    setHistoryIndex(nextIndex);
    setElements(history[nextIndex]);
  };

  const clearCanvas = () => {
    pushToHistory([]);
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");

    const a = document.createElement("a");
    a.href = url;
    a.download = "whiteboard.png";
    a.click();
  };

  const getCursor = () => {
    if (selectedTool === "hand" || action === "panning") return "grab";
    if (selectedTool === "text") return "text";
    if (selectedTool === "eraser" || selectedTool === "soft-eraser") return "crosshair";
    if (action === "moving") return "move";
    if (action === "resizing") return "nwse-resize";

    return "crosshair";
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-50">
      <TopBar
        onUndo={undo}
        onRedo={redo}
        onClear={clearCanvas}
        onExport={exportCanvas}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />

      <ToolSidebar
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        strokeColor={strokeColor}
        fillColor={fillColor}
        strokeWidth={strokeWidth}
        onStrokeColorChange={setStrokeColor}
        onFillColorChange={(color) => {
          setFillColor(color);
          setFillEnabled(true);
        }}
        onStrokeWidthChange={setStrokeWidth}
        onOpenLibrary={() => setLibraryOpen((v) => !v)}
      />

      {isLibraryOpen && (
        <IconLibrary
          onSelect={(icon) => {
            const id = uuid();

            pushToHistory([
              ...elements,
              {
                id,
                tool: "icon",
                x: -pan.x / zoom + 120,
                y: -pan.y / zoom + 120,
                width: 70,
                height: 70,
                color: `#${icon.hex}`,
                fillColor: "#ffffff",
                strokeWidth: 2,
                iconName: icon.title,
                iconColor: `#${icon.hex}`,
                iconPath: icon.path,
              },
            ]);

            setLibraryOpen(false);
          }}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {textInput.active && (
        <input
          autoFocus
          value={textInput.value}
          onChange={(e) =>
            setTextInput((prev) => ({
              ...prev,
              value: e.target.value,
            }))
          }
          onBlur={finalizeTextInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") finalizeTextInput();

            if (e.key === "Escape") {
              setTextInput({
                active: false,
                value: "",
                pos: { x: 0, y: 0 },
                targetId: null,
              });
            }
          }}
          className="fixed z-50 min-w-[120px] border-b-2 border-blue-500 bg-white/80 px-1 text-base outline-none"
          style={{
            left: textInput.pos.x * zoom + pan.x,
            top: textInput.pos.y * zoom + pan.y,
            color: strokeColor,
          }}
        />
      )}

      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-3 rounded-xl border bg-white p-3 shadow-lg">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.1, 4))}
          className="rounded px-3 py-1 hover:bg-gray-100"
        >
          +
        </button>

        <span className="font-mono text-sm">{Math.round(zoom * 100)}%</span>

        <button
          onClick={() => setZoom((z) => Math.max(z / 1.1, 0.25))}
          className="rounded px-3 py-1 hover:bg-gray-100"
        >
          −
        </button>

        <button
          onClick={() => setShowGrid((v) => !v)}
          className={`rounded px-3 py-1 ${
            showGrid ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          Grid
        </button>
      </div>

      <Canvas
        ref={canvasCallbackRef}
        elements={elements}
        pan={pan}
        zoom={zoom}
        showGrid={showGrid}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        cursor={getCursor()}
      />
    </div>
  );
};

export default App;