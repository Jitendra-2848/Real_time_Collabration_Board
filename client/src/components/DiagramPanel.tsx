import React, { useState } from "react";
import { parseDiagramCode } from "../lib/diagramParser";
import type { Element, Connector } from "../lib/types";
import { Wand2, Info, BookOpen, Layers, Play } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  onGenerate: (elements: Element[], connectors: Connector[]) => void;
  onClose: () => void;
}

export const DiagramPanel: React.FC<Props> = ({ onGenerate, onClose }) => {
  const [code, setCode] = useState<string>(`# Eraser.io Diagram-as-Code
# Write your code here to generate auto-aligned diagrams!

colorMode pastel
styleMode shadow
typeface clean

# Define Components with custom icons and shapes
Web App [icon: monitor, color: blue, shape: rectangle]
API Gateway [icon: cloud-cog, color: purple, shape: rectangle]
Database [icon: database, color: green, shape: cylinder]

# Data Flow / Connections
Web App > API Gateway: Submit transaction
API Gateway > Database: Save record [color: green]
Database > API Gateway: Success response
API Gateway > Web App: Confirmation
`);

  const [activeTab, setActiveTab] = useState<"editor" | "docs">("editor");

  const loadTemplate = (type: "sequence" | "block" | "flowchart") => {
    if (type === "sequence") {
      setCode(`# Sequence Diagram Example
colorMode pastel
styleMode shadow
typeface clean

# Actors / Entities
User [icon: user, color: blue]
Web App [icon: monitor, color: green]
Auth Service [icon: lock, color: purple]
SSO Provider [icon: cloud-cog, color: orange]

# Flow description
User > Web App: Clicks "Login with SSO"
Web App > Auth Service: Redirect to SSO provider
Auth Service > SSO Provider: Authenticate user

alt [label: Authentication successful, color: green] {
  SSO Provider > Auth Service: Return auth token [color: green]
  Auth Service > Web App: Send JWT Token
  Web App > User: Show dashboard
}
else [label: Auth failed, color: red] {
  SSO Provider > Auth Service: Access Denied [color: red]
  Auth Service > Web App: Authentication failed
  Web App > User: Show error message
}
`);
    } else if (type === "block") {
      setCode(`# Block / Architecture Diagram Example
colorMode bold
styleMode shadow
typeface clean

Frontend [color: blue] {
  User
  Web App [icon: monitor, color: blue]
}

Backend Services [color: purple] {
  API Gateway [icon: cloud-cog, color: purple]
  Order Service [icon: package, color: orange]
  Payment Service [icon: credit-card, color: red]
}

Data Layer [color: green] {
  Database [icon: database, color: green]
  Redis Cache [icon: zap, color: yellow]
}

# Connections
User > Web App: Orders items
Web App > API Gateway: API Request
API Gateway > Order Service: Submit order
Order Service > Payment Service: Process stripe payment
Payment Service > Order Service: Payment token
Order Service > Database: Insert order [color: green]
Order Service > Redis Cache: Cache session info
`);
    } else if (type === "flowchart") {
      setCode(`# Flowchart / Decision Flow Example
colorMode pastel
styleMode plain
typeface rough

Start [shape: oval, color: blue]
Decision [shape: diamond, color: yellow]
Process A [shape: rectangle, color: green]
Process B [shape: rectangle, color: red]
End [shape: oval, color: purple]

# Routing
Start > Decision: Input data
Decision > Process A: If value > 100
Decision > Process B: If value <= 100
Process A > End: Complete task A
Process B > End: Complete task B
`);
    }
  };

  const handleGenerate = () => {
    try {
      const { elements, connectors } = parseDiagramCode(code);
      onGenerate(elements, connectors);
      toast.success("Diagram generated successfully!");
    } catch (err: any) {
      toast.error(`Parsing failed: ${err.message || err}`);
    }
  };

  return (
    <div className="fixed top-24 right-4 z-30 w-[420px] max-h-[calc(100vh-140px)] flex flex-col rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50/50 to-white/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Wand2 size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Diagram-as-Code</h3>
            <p className="text-[10px] text-slate-400 font-medium">Auto-align blocks, arrows & groups</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-6 py-2 bg-slate-50/30 gap-4">
        <button
          onClick={() => setActiveTab("editor")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "editor"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <Layers size={13} />
          Editor
        </button>
        <button
          onClick={() => setActiveTab("docs")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "docs"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <BookOpen size={13} />
          Syntax Guide
        </button>
      </div>

      {activeTab === "editor" ? (
        <div className="flex flex-col flex-1 p-5 overflow-hidden">
          {/* Templates list */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Templates:</span>
            <button
              onClick={() => loadTemplate("sequence")}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
            >
              Sequence
            </button>
            <button
              onClick={() => loadTemplate("block")}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
            >
              Block Diagram
            </button>
            <button
              onClick={() => loadTemplate("flowchart")}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
            >
              Flowchart
            </button>
          </div>

          {/* Text Area */}
          <div className="flex-1 min-h-[200px] border border-slate-200 rounded-2xl overflow-hidden focus-within:border-indigo-400 transition-colors shadow-inner bg-slate-50/50">
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="# Write diagram-as-code here..."
              className="w-full h-full p-4 bg-transparent outline-none resize-none font-mono text-xs text-slate-700 leading-relaxed"
            />
          </div>

          {/* Action button */}
          <button
            onClick={handleGenerate}
            className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-100 hover:shadow-indigo-200/50 active:scale-[0.98] transition-all"
          >
            <Play size={13} fill="currentColor" />
            Generate Diagram on Canvas
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 text-slate-600 text-xs space-y-4 max-h-[350px]">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
              Define components with custom styles, draw arrows with text labels, and enclose them in groups or blocks for sequence logic.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1">🔷 Entities & Nodes</h4>
            <pre className="bg-slate-50 p-2 rounded-lg text-[10px] font-mono border border-slate-100 text-slate-700">
{`User [icon: user, color: blue, shape: oval]
DB [icon: database, color: green, shape: cylinder]`}
            </pre>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1">🔄 Connections (Arrows)</h4>
            <pre className="bg-slate-50 p-2 rounded-lg text-[10px] font-mono border border-slate-100 text-slate-700">
{`User > Web App: Submit order
Web App > DB: Query record [color: red]`}
            </pre>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1">📦 Groups</h4>
            <pre className="bg-slate-50 p-2 rounded-lg text-[10px] font-mono border border-slate-100 text-slate-700">
{`Backend [color: purple] {
  API Gateway
  Auth Service
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1">🎭 Sequence Control Blocks</h4>
            <pre className="bg-slate-50 p-2 rounded-lg text-[10px] font-mono border border-slate-100 text-slate-700">
{`alt [label: successful, color: green] {
  API > Client: confirm [color: blue]
}
else [label: failed, color: red] {
  API > Client: cancel
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1">🎨 Global Styling</h4>
            <pre className="bg-slate-50 p-2 rounded-lg text-[10px] font-mono border border-slate-100 text-slate-700">
{`colorMode pastel | bold | outline
styleMode shadow | plain | watercolor
typeface rough | clean | mono`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
