import React, { useState } from "react";
import { 
  Bold, Italic, Underline, Strikethrough, Code, Highlighter, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link, 
  List, ListOrdered, Quote, Undo2, Redo2, Type, Eraser
} from "lucide-react";
import type { Element } from "../lib/types";

interface Props {
  selectedElement: Element | null;
  onUpdateElement: (id: string, updates: Partial<Element>) => void;
  setEditingText: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const PRESET_COLORS = [
  "#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", 
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#64748b"
];

const PRESET_BG_COLORS = [
  "transparent", "#fee2e2", "#ffedd5", "#fef9c3", "#dcfce7", 
  "#dbeafe", "#e0e7ff", "#f3e8ff", "#fce7f3", "#f1f5f9"
];

const FONT_FAMILIES = [
  { label: "Comic Sans", value: "'Caveat', cursive, sans-serif" },
  { label: "Clean UI", value: "Inter, sans-serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Slab", value: "'Courier New', Courier, monospace" }
];

export const FormattingToolbar: React.FC<Props> = ({
  selectedElement,
  onUpdateElement,
  setEditingText,
  textareaRef,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) => {
  const [customColor, setCustomColor] = useState("");
  const [customBgColor, setCustomBgColor] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<"text" | "bg" | null>(null);

  if (!selectedElement) return null;

  const wrapSelection = (prefix: string, suffix: string, placeholder = "text") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const selectedText = text.substring(start, end) || placeholder;
    const replacement = `${prefix}${selectedText}${suffix}`;
    
    const newValue = text.substring(0, start) + replacement + text.substring(end);
    setEditingText(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const prependToLine = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = textarea.value;

    const lastNewline = text.lastIndexOf("\n", start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const newValue = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    setEditingText(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const clearFormatting = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    if (start === end) {
      const cleared = text
        .replace(/[\*\~\=\^]/g, "")
        .replace(/#+\s+/g, "")
        .replace(/>\s+/g, "");
      setEditingText(cleared);
    } else {
      const selected = text.substring(start, end);
      const cleared = selected.replace(/[\*\~\=\^]/g, "");
      const newValue = text.substring(0, start) + cleared + text.substring(end);
      setEditingText(newValue);
    }
  };

  const insertLink = () => {
    const url = window.prompt("Enter hyperlink URL (e.g. https://google.com):");
    if (url) {
      wrapSelection("[", `](${url})`, "link text");
    }
  };

  const insertSpecialChar = (char: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const text = textarea.value;
    const newValue = text.substring(0, start) + char + text.substring(start);
    setEditingText(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + char.length, start + char.length);
    }, 0);
  };

  const currentFontSize = selectedElement.fontSize || 14;
  const currentLineHeight = selectedElement.lineHeight || 1.4;
  const currentLetterSpacing = selectedElement.letterSpacing || 0;

  return (
    <div 
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl p-2 px-4 flex items-center gap-2 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-[95%] overflow-x-auto scrollbar-none"
      style={{ touchAction: "none" }}
      onMouseDown={e => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 border-r pr-2 border-slate-100">
        <button 
          onClick={onUndo} 
          disabled={!canUndo} 
          title="Undo"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 size={15} />
        </button>
        <button 
          onClick={onRedo} 
          disabled={!canRedo} 
          title="Redo"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Redo2 size={15} />
        </button>
      </div>

      <div className="flex items-center gap-0.5 border-r pr-2 border-slate-100">
        <button onClick={() => wrapSelection("**", "**", "bold")} title="Bold (Ctrl+B)" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Bold size={15} />
        </button>
        <button onClick={() => wrapSelection("*", "*", "italic")} title="Italic (Ctrl+I)" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Italic size={15} />
        </button>
        <button onClick={() => wrapSelection("~_", "_~", "underline")} title="Underline" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Underline size={15} />
        </button>
        <button onClick={() => wrapSelection("~~", "~~", "strike")} title="Strikethrough" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Strikethrough size={15} />
        </button>
        <button onClick={() => wrapSelection("`", "`", "code")} title="Code Block" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Code size={15} />
        </button>
        <button onClick={() => wrapSelection("==", "==", "highlight")} title="Highlight Background" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Highlighter size={15} />
        </button>
      </div>

      <div className="flex items-center gap-0.5 border-r pr-2 border-slate-100">
        <button onClick={() => prependToLine("* ")} title="Bullet List" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <List size={15} />
        </button>
        <button onClick={() => prependToLine("1. ")} title="Numbered List" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <ListOrdered size={15} />
        </button>
        <button onClick={() => prependToLine("> ")} title="Blockquote" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Quote size={15} />
        </button>
        <button onClick={() => wrapSelection("^", "^", "sup")} title="Superscript" className="p-1.5 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-600">
          X<sup>y</sup>
        </button>
        <button onClick={() => wrapSelection("~", "~", "sub")} title="Subscript" className="p-1.5 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-600">
          X<sub>y</sub>
        </button>
      </div>

      <div className="flex items-center gap-1 border-r pr-2 border-slate-100">
        <select 
          onChange={(e) => {
            const h = e.target.value;
            if (h === "Normal") clearFormatting();
            else prependToLine(`${h} `);
            e.target.value = "Headings";
          }}
          defaultValue="Headings"
          className="text-xs bg-slate-50 border border-slate-200 rounded p-1 text-slate-700 outline-none w-20 cursor-pointer"
        >
          <option value="Headings" disabled>Headings</option>
          <option value="Normal">Normal</option>
          <option value="# ">Heading 1</option>
          <option value="## ">Heading 2</option>
          <option value="### ">Heading 3</option>
          <option value="#### ">Heading 4</option>
        </select>
      </div>

      <div className="flex items-center gap-1 border-r pr-2 border-slate-100">
        <div className="flex items-center gap-0.5" title="Font Size">
          <Type size={14} className="text-slate-400" />
          <input 
            type="number" 
            min="10" 
            max="60" 
            value={currentFontSize}
            onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 14 })}
            className="w-10 text-xs bg-slate-50 border border-slate-200 rounded p-1 text-slate-700 text-center outline-none"
          />
          <span className="text-[10px] text-slate-400 font-medium">px</span>
        </div>

        <select 
          value={selectedElement.fontFamily || ""}
          onChange={(e) => onUpdateElement(selectedElement.id, { fontFamily: e.target.value })}
          className="text-xs bg-slate-50 border border-slate-200 rounded p-1 text-slate-700 outline-none w-24 cursor-pointer"
        >
          <option value="">Default Font</option>
          {FONT_FAMILIES.map(ff => (
            <option key={ff.label} value={ff.value}>{ff.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-0.5 border-r pr-2 border-slate-100">
        <button 
          onClick={() => onUpdateElement(selectedElement.id, { textAlign: "left" })} 
          title="Align Left" 
          className={`p-1.5 rounded ${selectedElement.textAlign === "left" ? "bg-slate-200 text-blue-600" : "hover:bg-slate-100 text-slate-600"}`}
        >
          <AlignLeft size={15} />
        </button>
        <button 
          onClick={() => onUpdateElement(selectedElement.id, { textAlign: "center" })} 
          title="Align Center" 
          className={`p-1.5 rounded ${selectedElement.textAlign === "center" ? "bg-slate-200 text-blue-600" : "hover:bg-slate-100 text-slate-600"}`}
        >
          <AlignCenter size={15} />
        </button>
        <button 
          onClick={() => onUpdateElement(selectedElement.id, { textAlign: "right" })} 
          title="Align Right" 
          className={`p-1.5 rounded ${selectedElement.textAlign === "right" ? "bg-slate-200 text-blue-600" : "hover:bg-slate-100 text-slate-600"}`}
        >
          <AlignRight size={15} />
        </button>
        <button 
          onClick={() => onUpdateElement(selectedElement.id, { textAlign: "justify" })} 
          title="Justify" 
          className={`p-1.5 rounded ${selectedElement.textAlign === "justify" ? "bg-slate-200 text-blue-600" : "hover:bg-slate-100 text-slate-600"}`}
        >
          <AlignJustify size={15} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 border-r pr-2 border-slate-100 text-xs">
        <div className="flex items-center gap-1" title="Line Height">
          <span className="text-[10px] text-slate-400 font-bold">LH</span>
          <select 
            value={currentLineHeight}
            onChange={(e) => onUpdateElement(selectedElement.id, { lineHeight: parseFloat(e.target.value) })}
            className="bg-slate-50 border border-slate-200 rounded p-0.5 text-slate-700 outline-none w-14 cursor-pointer"
          >
            <option value="1.0">1.0</option>
            <option value="1.2">1.2</option>
            <option value="1.4">1.4</option>
            <option value="1.6">1.6</option>
            <option value="1.8">1.8</option>
            <option value="2.0">2.0</option>
          </select>
        </div>

        <div className="flex items-center gap-1" title="Letter Spacing">
          <span className="text-[10px] text-slate-400 font-bold">LS</span>
          <select 
            value={currentLetterSpacing}
            onChange={(e) => onUpdateElement(selectedElement.id, { letterSpacing: parseFloat(e.target.value) })}
            className="bg-slate-50 border border-slate-200 rounded p-0.5 text-slate-700 outline-none w-14 cursor-pointer"
          >
            <option value="0">0</option>
            <option value="1">1px</option>
            <option value="2">2px</option>
            <option value="3">3px</option>
            <option value="4">4px</option>
          </select>
        </div>

        <div className="flex items-center gap-1" title="Block Padding">
          <span className="text-[10px] text-slate-400 font-bold">Pad</span>
          <input 
            type="number" 
            min="0" 
            max="40" 
            value={selectedElement.padding !== undefined ? selectedElement.padding : 8}
            onChange={(e) => onUpdateElement(selectedElement.id, { padding: parseInt(e.target.value) || 0 })}
            className="w-8 bg-slate-50 border border-slate-200 rounded p-0.5 text-slate-700 text-center outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 relative border-r pr-2 border-slate-100">
        <button 
          onClick={() => setShowColorPicker(showColorPicker === "text" ? null : "text")}
          className="flex items-center gap-1 p-1 hover:bg-slate-100 rounded"
          title="Text Color"
        >
          <span className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: selectedElement.color }} />
          <span className="text-[10px] text-slate-500 font-bold">A</span>
        </button>

        <button 
          onClick={() => setShowColorPicker(showColorPicker === "bg" ? null : "bg")}
          className="flex items-center gap-1 p-1 hover:bg-slate-100 rounded"
          title="Block Background"
        >
          <span 
            className="w-4 h-4 rounded border border-slate-300 relative overflow-hidden" 
            style={{ backgroundColor: selectedElement.fillColor === "transparent" ? "#ffffff" : selectedElement.fillColor }}
          >
            {selectedElement.fillColor === "transparent" && (
              <span className="absolute inset-0 bg-red-500 w-[1px] h-full rotate-45 left-1/2 -translate-x-1/2" />
            )}
          </span>
          <span className="text-[10px] text-slate-500 font-bold">BG</span>
        </button>

        {showColorPicker && (
          <div className="absolute bottom-11 right-0 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-[310] w-48 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {showColorPicker === "text" ? "Text Color" : "Background"}
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {(showColorPicker === "text" ? PRESET_COLORS : PRESET_BG_COLORS).map(color => (
                <button
                  key={color}
                  onClick={() => {
                    if (showColorPicker === "text") {
                      onUpdateElement(selectedElement.id, { color });
                    } else {
                      onUpdateElement(selectedElement.id, { fillColor: color });
                    }
                    setShowColorPicker(null);
                  }}
                  className="w-6 h-6 rounded-full border border-slate-200 cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: color === "transparent" ? "#fff" : color }}
                >
                  {color === "transparent" && (
                    <span className="absolute inset-0 bg-red-500 w-[1.5px] h-full rotate-45 left-1/2 -translate-x-1/2" />
                  )}
                </button>
              ))}
            </div>
            
            <div className="flex gap-1 items-center mt-1 border-t pt-1.5 border-slate-100">
              <span className="text-[10px] text-slate-400">#</span>
              <input 
                type="text" 
                placeholder="HEX" 
                maxLength={6}
                value={showColorPicker === "text" ? customColor : customBgColor}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  if (showColorPicker === "text") setCustomColor(val);
                  else setCustomBgColor(val);
                }}
                className="w-20 text-[10px] bg-slate-50 border border-slate-200 rounded p-1 text-slate-700 outline-none"
              />
              <button
                onClick={() => {
                  const hex = showColorPicker === "text" ? customColor : customBgColor;
                  if (/^[0-9A-F]{3,6}$/i.test(hex)) {
                    const formatted = `#${hex}`;
                    if (showColorPicker === "text") {
                      onUpdateElement(selectedElement.id, { color: formatted });
                    } else {
                      onUpdateElement(selectedElement.id, { fillColor: formatted });
                    }
                  }
                  setShowColorPicker(null);
                }}
                className="text-[9px] bg-blue-500 text-white font-bold px-1.5 py-1 rounded"
              >
                Set
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 border-r pr-2 border-slate-100">
        <button onClick={insertLink} title="Insert Hyperlink (Ctrl+K)" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Link size={15} />
        </button>
        <button onClick={clearFormatting} title="Clear Formatting" className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
          <Eraser size={15} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {["©", "™", "®", "€", "•", "→"].map(char => (
          <button 
            key={char} 
            onClick={() => insertSpecialChar(char)}
            className="w-5 h-5 text-[10px] hover:bg-slate-100 border border-slate-100 rounded flex items-center justify-center font-bold text-slate-500"
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
