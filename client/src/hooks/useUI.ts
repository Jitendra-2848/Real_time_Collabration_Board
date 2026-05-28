import { useState } from "react";

export const useUI = () => {
  const [selectedTool, setSelectedTool] = useState<any>("select");
  const [action, setAction] = useState<any>("none");
  
  // Panels
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [isLibraryOpen, setLibraryOpen] = useState(false);
  
  // Display
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId?: string } | null>(null);

  return {
    selectedTool,
    setSelectedTool,
    action,
    setAction,
    commentsPanelOpen,
    setCommentsPanelOpen,
    layersPanelOpen,
    setLayersPanelOpen,
    propertiesPanelOpen,
    setPropertiesPanelOpen,
    templatesOpen,
    setTemplatesOpen,
    isLibraryOpen,
    setLibraryOpen,
    showGrid,
    setShowGrid,
    showMinimap,
    setShowMinimap,
    presentationMode,
    setPresentationMode,
    presentationIndex,
    setPresentationIndex,
    contextMenu,
    setContextMenu
  };
};
