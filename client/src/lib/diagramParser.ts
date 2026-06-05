import type { Element, Connector, TextStyle } from "./types";

const ICON_PATH_MAP: Record<string, { viewBox: string; paths: string[] }> = {
  monitor: {
    viewBox: "0 0 24 24",
    paths: ["M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v2h10v-2l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"]
  },
  database: {
    viewBox: "0 0 24 24",
    paths: ["M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 2c3.74 0 8 1.15 8 2.5S15.74 9 12 9 4 7.85 4 6.5 8.26 4 12 4zm8 13.5c0 1.35-4.26 2.5-8 2.5s-8-1.15-8-2.5V15.5c0 1.35 4.26 2.5 8 2.5s8-1.15 8-2.5v2zm0-4.5c0 1.35-4.26 2.5-8 2.5s-8-1.15-8-2.5V11c0 1.35 4.26 2.5 8 2.5s8-1.15 8-2.5v2z"]
  },
  user: {
    viewBox: "0 0 24 24",
    paths: ["M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"]
  },
  lock: {
    viewBox: "0 0 24 24",
    paths: ["M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"]
  },
  "cloud-cog": {
    viewBox: "0 0 24 24",
    paths: ["M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"]
  },
  cloud: {
    viewBox: "0 0 24 24",
    paths: ["M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"]
  },
  zap: {
    viewBox: "0 0 24 24",
    paths: ["M7 2v11h3v9l7-12h-4l4-8z"]
  },
  package: {
    viewBox: "0 0 24 24",
    paths: ["M12 2L2 7l10 5 10-5-10-5zm-1 17.5V13.8L3 9.3v6.5l8 3.7zm2 0l8-3.7V9.3l-8 4.5v5.7z"]
  },
  "credit-card": {
    viewBox: "0 0 24 24",
    paths: ["M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"]
  },
  "check-circle": {
    viewBox: "0 0 24 24",
    paths: ["M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"]
  },
  check: {
    viewBox: "0 0 24 24",
    paths: ["M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"]
  },
  "alert-circle": {
    viewBox: "0 0 24 24",
    paths: ["M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"]
  },
  alert: {
    viewBox: "0 0 24 24",
    paths: ["M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"]
  },
  bug: {
    viewBox: "0 0 24 24",
    paths: ["M19 8h-1.81a5.985 5.985 0 00-1.82-1.96L17 4.41 15.59 3l-2.17 2.17a6.002 6.002 0 00-2.83 0L8.41 3 7 4.41l1.62 1.63C7.88 6.68 7.3 7.31 6.81 8H5v2h1.09c-.05.33-.09.66-.09 1v1H5v2h1c0 .34.04.67.09 1H5v2h1.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H19v-2h-1.09c.05-.33.09-.66.09-1v-1h1v-2h-1v-1c0-.34-.04-.67-.09-1H19V8zm-6 8h-2v-2h2v2zm0-4h-2V10h2v2z"]
  },
  server: {
    viewBox: "0 0 24 24",
    paths: ["M20 4H4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 4H4V6h8v2zm8 6H4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2zm-8 4H4v-2h8v2z"]
  },
  "aws-ec2": {
    viewBox: "0 0 24 24",
    paths: ["M20 4H4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 4H4V6h8v2zm8 6H4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2zm-8 4H4v-2h8v2z"]
  },
  function: {
    viewBox: "0 0 24 24",
    paths: ["M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"]
  }
};

interface ParsedNode {
  name: string;
  icon?: string;
  color?: string;
  shape?: string;
  typeface?: TextStyle;
}

interface ParsedConnection {
  from: string;
  to: string;
  message?: string;
  color?: string;
}

interface BlockStackItem {
  type: string;
  label?: string;
  color?: string;
  icon?: string;
  startStep: number;
}

export function parseDiagramCode(code: string): { elements: Element[]; connectors: Connector[] } {
  const lines = code.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  // Global settings
  let colorMode: "pastel" | "bold" | "outline" = "pastel";
  let styleMode: "shadow" | "plain" | "watercolor" = "shadow";
  let typeface: TextStyle = "clean";

  const nodes: Map<string, ParsedNode> = new Map();
  const connections: ParsedConnection[] = [];
  const groups: Map<string, { nodes: string[]; color?: string }> = new Map();

  // Parsing state
  let currentGroup: { name: string; color?: string } | null = null;
  const allBlocks: BlockStackItem[] = [];
  const blockStack: number[] = [];
  const sequenceSteps: Array<{
    type: "message" | "block-start" | "block-end";
    messageIndex?: number;
    blockIndex?: number;
  }> = [];

  // Parse properties utility, e.g. [icon: monitor, color: blue]
  const parseProps = (propStr: string): Record<string, string> => {
    const props: Record<string, string> = {};
    if (!propStr) return props;
    const parts = propStr.replace(/[\[\]]/g, "").split(",");
    parts.forEach(p => {
      const kv = p.split(":");
      if (kv.length === 2) {
        props[kv[0].trim()] = kv[1].trim();
      }
    });
    return props;
  };

  // Detect diagram type (default to block, unless alt/loop/sequence keywords or lifelines are present)
  let isSequenceDiagram = false;
  for (const line of lines) {
    if (
      line.startsWith("alt") ||
      line.startsWith("loop") ||
      line.startsWith("opt") ||
      line.startsWith("par") ||
      line.startsWith("break") ||
      line.startsWith("else") ||
      line.includes("activate") ||
      line.includes("deactivate")
    ) {
      isSequenceDiagram = true;
      break;
    }
  }

  // First pass parsing
  lines.forEach(line => {
    // 1. Comments
    if (line.startsWith("#")) return;

    // 2. Global settings
    if (line.startsWith("colorMode")) {
      const val = line.split(/\s+/)[1];
      if (val === "bold" || val === "outline" || val === "pastel") colorMode = val;
      return;
    }
    if (line.startsWith("styleMode")) {
      const val = line.split(/\s+/)[1];
      if (val === "shadow" || val === "plain" || val === "watercolor") styleMode = val;
      return;
    }
    if (line.startsWith("typeface")) {
      const val = line.split(/\s+/)[1];
      if (val === "rough" || val === "mono" || val === "clean") typeface = val as TextStyle;
      return;
    }

    // 3. Group open
    // Example: GroupName [color: purple] {
    if (line.endsWith("{") && !line.startsWith("alt") && !line.startsWith("else") && !line.startsWith("loop") && !line.startsWith("opt") && !line.startsWith("par") && !line.startsWith("break")) {
      const namePart = line.substring(0, line.length - 1).trim();
      const propMatch = namePart.match(/\[(.*?)\]/);
      const name = propMatch ? namePart.replace(propMatch[0], "").trim() : namePart;
      const props = propMatch ? parseProps(propMatch[1]) : {};
      currentGroup = { name, color: props.color };
      groups.set(name, { nodes: [], color: props.color });
      return;
    }

    // 4. Block controls for Sequence Diagrams
    // Example: alt [label: If successful, color: green, icon: check-circle] {
    if (line.endsWith("{") && (line.startsWith("alt") || line.startsWith("else") || line.startsWith("loop") || line.startsWith("opt") || line.startsWith("par") || line.startsWith("break"))) {
      isSequenceDiagram = true;
      const firstWord = line.split(/\s+/)[0];
      const propMatch = line.match(/\[(.*?)\]/);
      const props = propMatch ? parseProps(propMatch[1]) : {};
      const blockItem: BlockStackItem = {
        type: firstWord,
        label: props.label || "",
        color: props.color,
        icon: props.icon,
        startStep: sequenceSteps.length
      };
      allBlocks.push(blockItem);
      const blockIdx = allBlocks.length - 1;
      blockStack.push(blockIdx);
      sequenceSteps.push({ type: "block-start", blockIndex: blockIdx });
      return;
    }

    // 5. Braces closing
    if (line === "}") {
      if (blockStack.length > 0) {
        const blockIdx = blockStack.pop();
        if (blockIdx !== undefined) {
          sequenceSteps.push({ type: "block-end", blockIndex: blockIdx });
        }
      } else {
        currentGroup = null;
      }
      return;
    }

    // 6. Arrow / Connection
    // Example: Actor A > Actor B: Message text [color: red]
    if (line.includes(">")) {
      const parts = line.split(">");
      const fromPart = parts[0].trim();
      const rest = parts.slice(1).join(">").trim();
      
      const colonIndex = rest.indexOf(":");
      let toPart = "";
      let message = "";
      let props: Record<string, string> = {};

      if (colonIndex !== -1) {
        toPart = rest.substring(0, colonIndex).trim();
        const msgPart = rest.substring(colonIndex + 1).trim();
        const propMatch = msgMatch(msgPart);
        message = propMatch ? msgPart.substring(0, propMatch.index).trim() : msgPart;
        props = propMatch ? parseProps(propMatch.value) : {};
      } else {
        const propMatch = msgMatch(rest);
        toPart = propMatch ? rest.substring(0, propMatch.index).trim() : rest;
        props = propMatch ? parseProps(propMatch.value) : {};
      }

      // Add implicit nodes
      if (!nodes.has(fromPart)) nodes.set(fromPart, { name: fromPart });
      if (!nodes.has(toPart)) nodes.set(toPart, { name: toPart });

      if (currentGroup) {
        groups.get(currentGroup.name)?.nodes.push(fromPart);
        groups.get(currentGroup.name)?.nodes.push(toPart);
      }

      connections.push({ from: fromPart, to: toPart, message, color: props.color });
      if (isSequenceDiagram) {
        sequenceSteps.push({ type: "message", messageIndex: connections.length - 1 });
      }
      return;
    }

    // Helper function to extract properties matching [color: ...]
    function msgMatch(str: string) {
      const m = str.match(/\[(.*?)\]$/);
      if (m && m.index !== undefined) {
        return { index: m.index, value: m[0] };
      }
      return null;
    }

    // 7. Node declaration
    // Example: User [icon: user, color: blue, shape: rectangle]
    const propMatch = line.match(/\[(.*?)\]/);
    const nodeName = propMatch ? line.substring(0, propMatch.index).trim() : line;
    const props = propMatch ? parseProps(propMatch[1]) : {};
    
    const nodeObj: ParsedNode = {
      name: nodeName,
      icon: props.icon,
      color: props.color,
      shape: props.shape,
      typeface: props.typeface as TextStyle
    };
    nodes.set(nodeName, nodeObj);

    if (currentGroup) {
      groups.get(currentGroup.name)?.nodes.push(nodeName);
    }
  });

  // Color mapping helper
  const getColorValue = (colorName: string | undefined, mode: "stroke" | "fill"): string => {
    if (!colorName) {
      if (mode === "stroke") return "#1e293b"; // Slate-800
      return "transparent";
    }
    const colorMap: Record<string, { bold: string; pastel: string }> = {
      blue: { bold: "#2563eb", pastel: "#dbeafe" },
      green: { bold: "#16a34a", pastel: "#dcfce7" },
      red: { bold: "#dc2626", pastel: "#fee2e2" },
      purple: { bold: "#7c3aed", pastel: "#f3e8ff" },
      orange: { bold: "#ea580c", pastel: "#ffedd5" },
      yellow: { bold: "#ca8a04", pastel: "#fef9c3" },
      grey: { bold: "#4b5563", pastel: "#f3f4f6" },
      gray: { bold: "#4b5563", pastel: "#f3f4f6" },
    };

    const standard = colorMap[colorName.toLowerCase()];
    if (standard) {
      if (colorMode === "outline") {
        return mode === "stroke" ? standard.bold : "transparent";
      }
      if (colorMode === "bold") {
        return mode === "stroke" ? "#1e293b" : standard.bold;
      }
      // pastel
      return mode === "stroke" ? standard.bold : standard.pastel;
    }

    // Fallback: if it's already a hex color
    if (colorName.startsWith("#")) return colorName;
    return colorName;
  };

  const elements: Element[] = [];
  const connectors: Connector[] = [];

  // =========================================================
  // SEQUENCE DIAGRAM AUTO-LAYOUT
  // =========================================================
  if (isSequenceDiagram) {
    const actorNames = Array.from(nodes.keys());
    const actorElements: Record<string, Element> = {};
    const actorLifelines: Record<string, Element> = {};

    const startX = 100;
    const spacingX = 220;
    const startY = 100;
    const actorHeight = 50;
    const actorWidth = 130;

    // 1. Create Actor Node Elements
    actorNames.forEach((name, idx) => {
      const nodeInfo = nodes.get(name);
      const x = startX + idx * spacingX;
      
      const strokeColor = getColorValue(nodeInfo?.color, "stroke");
      const fillColor = getColorValue(nodeInfo?.color || "grey", "fill");

      const actorEl: Element = {
        id: `actor-${idx}`,
        tool: (nodeInfo?.shape === "oval" ? "circle" : "rect") as any,
        x,
        y: startY,
        width: actorWidth,
        height: actorHeight,
        color: strokeColor,
        fillColor: fillColor,
        strokeWidth: 2,
        opacity: 1,
        text: name,
        textStyle: nodeInfo?.typeface || typeface,
        icon: nodeInfo?.icon,
        iconName: nodeInfo?.icon,
        resizable: true,
        groupId: "sequence-actors",
        styleMode: styleMode
      };

      const actorIcon = nodeInfo?.icon;
      const actorIconData = actorIcon ? ICON_PATH_MAP[actorIcon.toLowerCase()] : null;
      if (actorIconData) {
        actorEl.svgPaths = actorIconData.paths;
        actorEl.viewBox = actorIconData.viewBox;
      }

      // Auto-attaching support: Add anchors
      actorEl.anchors = [
        { id: `actor-${idx}-top`, elementId: actorEl.id, x: x + actorWidth / 2, y: startY, position: "top" },
        { id: `actor-${idx}-bottom`, elementId: actorEl.id, x: x + actorWidth / 2, y: startY + actorHeight, position: "bottom" },
        { id: `actor-${idx}-left`, elementId: actorEl.id, x, y: startY + actorHeight / 2, position: "left" },
        { id: `actor-${idx}-right`, elementId: actorEl.id, x: x + actorWidth, y: startY + actorHeight / 2, position: "right" },
        { id: `actor-${idx}-center`, elementId: actorEl.id, x: x + actorWidth / 2, y: startY + actorHeight / 2, position: "center" }
      ];

      elements.push(actorEl);
      actorElements[name] = actorEl;
    });

    // 2. Compute steps & Draw Lifelines/Messages
    let currentY = startY + actorHeight + 40;
    const stepSpacing = 70;

    const blockBoxes: Array<{
      item: BlockStackItem;
      startY: number;
      endY?: number;
      involvedActors: Set<string>;
    }> = [];

    const activeBlocks: typeof blockBoxes = [];

    sequenceSteps.forEach(step => {
      if (step.type === "block-start" && step.blockIndex !== undefined) {
        const bItem = allBlocks[step.blockIndex];
        const activeBlock = {
          item: bItem,
          startY: currentY - 15,
          involvedActors: new Set<string>()
        };
        activeBlocks.push(activeBlock);
        blockBoxes.push(activeBlock);
      } else if (step.type === "block-end" && step.blockIndex !== undefined) {
        const activeBlock = activeBlocks.pop();
        if (activeBlock) {
          activeBlock.endY = currentY + 10;
        }
      } else if (step.type === "message" && step.messageIndex !== undefined) {
        const conn = connections[step.messageIndex];
        const fromActor = actorElements[conn.from];
        const toActor = actorElements[conn.to];

        if (fromActor && toActor) {
          // Track involved actors in active blocks
          activeBlocks.forEach(ab => {
            ab.involvedActors.add(conn.from);
            ab.involvedActors.add(conn.to);
          });

          const x1 = fromActor.x + actorWidth / 2;
          const x2 = toActor.x + actorWidth / 2;

          // Message Arrow (drawn as Line element with arrowhead)
          const arrowEl: Element = {
            id: `msg-arrow-${step.messageIndex}`,
            tool: "arrow",
            x: x1,
            y: currentY,
            width: x2 - x1,
            height: 0,
            points: [{ x: x1, y: currentY }, { x: x2, y: currentY }],
            color: getColorValue(conn.color, "stroke"),
            strokeWidth: 2,
            opacity: 1,
            arrowStyle: "filled",
            lineStyle: "solid"
          };
          elements.push(arrowEl);

          // Message Text Label
          const labelWidth = 150;
          const labelHeight = 25;
          const labelText: Element = {
            id: `msg-label-${step.messageIndex}`,
            tool: "text",
            x: (x1 + x2) / 2 - labelWidth / 2,
            y: currentY - 22,
            width: labelWidth,
            height: labelHeight,
            color: "#334155",
            strokeWidth: 1,
            text: conn.message || "",
            textStyle: typeface,
            opacity: 1
          };
          elements.push(labelText);
        }
        currentY += stepSpacing;
      }
    });

    const totalHeight = currentY + 30;

    // 3. Create Lifelines (dashed vertical lines)
    actorNames.forEach((name, idx) => {
      const actorEl = actorElements[name];
      const x = actorEl.x + actorWidth / 2;
      const lineEl: Element = {
        id: `lifeline-${idx}`,
        tool: "line",
        x,
        y: startY + actorHeight,
        width: 0,
        height: totalHeight - (startY + actorHeight),
        points: [{ x, y: startY + actorHeight }, { x, y: totalHeight }],
        color: "#94a3b8",
        strokeWidth: 1.5,
        opacity: 0.7,
        lineStyle: "dashed"
      };
      elements.push(lineEl);
      actorLifelines[name] = lineEl;
    });

    // 4. Render control blocks (e.g. alt, loop) around lifelines
    blockBoxes.forEach((bb, idx) => {
      const endY = bb.endY || totalHeight;
      const startY = bb.startY;
      const height = endY - startY;

      // Find bounds based on involved actors
      let minX = Infinity;
      let maxX = -Infinity;

      bb.involvedActors.forEach(act => {
        const actorEl = actorElements[act];
        if (actorEl) {
          minX = Math.min(minX, actorEl.x - 20);
          maxX = Math.max(maxX, actorEl.x + actorWidth + 20);
        }
      });

      if (minX === Infinity) {
        minX = startX - 25;
        maxX = startX + actorNames.length * spacingX - spacingX + actorWidth + 25;
      }

      const width = maxX - minX;
      const blockColor = getColorValue(bb.item.color || "grey", "fill");
      const strokeColor = getColorValue(bb.item.color || "grey", "stroke");

      // Draw the block container rectangle
      const blockEl: Element = {
        id: `block-box-${idx}`,
        tool: "rect",
        x: minX,
        y: startY,
        width,
        height,
        color: strokeColor,
        fillColor: blockColor !== "transparent" ? blockColor : "rgba(248, 250, 252, 0.4)",
        strokeWidth: 1.5,
        lineStyle: "dashed",
        opacity: 0.95,
        text: "",
        groupId: `block-${bb.item.type}`,
        styleMode: styleMode
      };
      elements.push(blockEl);

      // Draw label badge
      const badgeWidth = Math.min(180, width - 10);
      const labelText = `${bb.item.type.toUpperCase()}${bb.item.label ? ` [${bb.item.label}]` : ""}`;
      const blockIcon = bb.item.icon;
      const iconData = blockIcon ? ICON_PATH_MAP[blockIcon.toLowerCase()] : null;
      
      const badgeEl: Element = {
        id: `block-badge-${idx}`,
        tool: "rect",
        x: minX + 5,
        y: startY + 5,
        width: badgeWidth,
        height: 22,
        color: strokeColor,
        fillColor: "rgba(255, 255, 255, 0.9)",
        strokeWidth: 1,
        opacity: 1,
        text: labelText,
        textStyle: "mono",
        groupId: `block-${bb.item.type}`,
        icon: blockIcon,
        iconName: blockIcon,
        svgPaths: iconData?.paths,
        viewBox: iconData?.viewBox
      };
      elements.push(badgeEl);
    });

  } else {
    // =========================================================
    // BLOCK DIAGRAM / FLOWCHART AUTO-LAYOUT
    // =========================================================
    const nodeNames = Array.from(nodes.keys());
    const placedNodes: Record<string, Element> = {};
    // Sort nodes by groups
    const unassignedNodes = new Set(nodeNames);

    // Lay out Groups
    let groupIndex = 0;
    groups.forEach((gData, groupName) => {
      const gColor = getColorValue(gData.color || "purple", "fill");
      const gStroke = getColorValue(gData.color || "purple", "stroke");

      const nodeSpacingY = 110;
      const groupWidth = 240;
      const groupHeight = 60 + gData.nodes.length * nodeSpacingY;

      const groupX = 150 + groupIndex * 300;
      const groupY = 150;

      // Group Container Element
      const groupEl: Element = {
        id: `group-container-${groupName}`,
        tool: "rect",
        x: groupX,
        y: groupY,
        width: groupWidth,
        height: groupHeight,
        color: gStroke,
        fillColor: gColor !== "transparent" ? gColor : "rgba(241, 245, 249, 0.4)",
        strokeWidth: 1.5,
        lineStyle: "solid",
        opacity: 0.9,
        text: `Group: ${groupName}`,
        textStyle: "mono",
        groupId: `group-${groupName}`,
        styleMode: styleMode
      };
      elements.push(groupEl);

      gData.nodes.forEach((nodeName, nodeIdx) => {
        if (!unassignedNodes.has(nodeName)) return; // already placed
        unassignedNodes.delete(nodeName);

        const nodeInfo = nodes.get(nodeName);
        const nodeX = groupX + 30;
        const nodeY = groupY + 50 + nodeIdx * nodeSpacingY;
        const nodeW = 180;
        const nodeH = 60;

        const nStroke = getColorValue(nodeInfo?.color, "stroke");
        const nFill = getColorValue(nodeInfo?.color || "blue", "fill");

        // Map shape names to standard whiteboard tools
        let toolType: any = "rect";
        if (nodeInfo?.shape === "oval") toolType = "circle";
        else if (nodeInfo?.shape === "diamond") toolType = "diamond";
        else if (nodeInfo?.shape === "cylinder") toolType = "cylinder";

        const nodeEl: Element = {
          id: `node-${nodeName}`,
          tool: toolType,
          x: nodeX,
          y: nodeY,
          width: nodeW,
          height: nodeH,
          color: nStroke,
          fillColor: nFill,
          strokeWidth: styleMode === "watercolor" ? 3 : 2,
          opacity: 1,
          text: nodeName,
          textStyle: nodeInfo?.typeface || typeface,
          icon: nodeInfo?.icon,
          iconName: nodeInfo?.icon,
          resizable: true,
          groupId: `group-${groupName}`,
          styleMode: styleMode
        };

        const nodeIcon = nodeInfo?.icon;
        const nodeIconData = nodeIcon ? ICON_PATH_MAP[nodeIcon.toLowerCase()] : null;
        if (nodeIconData) {
          nodeEl.svgPaths = nodeIconData.paths;
          nodeEl.viewBox = nodeIconData.viewBox;
        }

        // Anchors for connectors
        nodeEl.anchors = [
          { id: `node-${nodeName}-top`, elementId: nodeEl.id, x: nodeX + nodeW / 2, y: nodeY, position: "top" },
          { id: `node-${nodeName}-bottom`, elementId: nodeEl.id, x: nodeX + nodeW / 2, y: nodeY + nodeH, position: "bottom" },
          { id: `node-${nodeName}-left`, elementId: nodeEl.id, x: nodeX, y: nodeY + nodeH / 2, position: "left" },
          { id: `node-${nodeName}-right`, elementId: nodeEl.id, x: nodeX + nodeW, y: nodeY + nodeH / 2, position: "right" },
          { id: `node-${nodeName}-center`, elementId: nodeEl.id, x: nodeX + nodeW / 2, y: nodeY + nodeH / 2, position: "center" }
        ];

        elements.push(nodeEl);
        placedNodes[nodeName] = nodeEl;
      });

      groupIndex++;
    });

    // Lay out unassigned nodes (in a row/column layout)
    const extraNodes = Array.from(unassignedNodes);
    extraNodes.forEach((nodeName, idx) => {
      const nodeInfo = nodes.get(nodeName);
      const nodeX = 150 + groupIndex * 300 + (idx % 2) * 250;
      const nodeY = 150 + Math.floor(idx / 2) * 120;
      const nodeW = 180;
      const nodeH = 60;

      const nStroke = getColorValue(nodeInfo?.color, "stroke");
      const nFill = getColorValue(nodeInfo?.color || "grey", "fill");

      let toolType: any = "rect";
      if (nodeInfo?.shape === "oval") toolType = "circle";
      else if (nodeInfo?.shape === "diamond") toolType = "diamond";
      else if (nodeInfo?.shape === "cylinder") toolType = "cylinder";

      const nodeEl: Element = {
        id: `node-${nodeName}`,
        tool: toolType,
        x: nodeX,
        y: nodeY,
        width: nodeW,
        height: nodeH,
        color: nStroke,
        fillColor: nFill,
        strokeWidth: 2,
        opacity: 1,
        text: nodeName,
        textStyle: nodeInfo?.typeface || typeface,
        icon: nodeInfo?.icon,
        iconName: nodeInfo?.icon,
        resizable: true,
        styleMode: styleMode
      };

      const nodeIcon = nodeInfo?.icon;
      const nodeIconData = nodeIcon ? ICON_PATH_MAP[nodeIcon.toLowerCase()] : null;
      if (nodeIconData) {
        nodeEl.svgPaths = nodeIconData.paths;
        nodeEl.viewBox = nodeIconData.viewBox;
      }

      nodeEl.anchors = [
        { id: `node-${nodeName}-top`, elementId: nodeEl.id, x: nodeX + nodeW / 2, y: nodeY, position: "top" },
        { id: `node-${nodeName}-bottom`, elementId: nodeEl.id, x: nodeX + nodeW / 2, y: nodeY + nodeH, position: "bottom" },
        { id: `node-${nodeName}-left`, elementId: nodeEl.id, x: nodeX, y: nodeY + nodeH / 2, position: "left" },
        { id: `node-${nodeName}-right`, elementId: nodeEl.id, x: nodeX + nodeW, y: nodeY + nodeH / 2, position: "right" },
        { id: `node-${nodeName}-center`, elementId: nodeEl.id, x: nodeX + nodeW / 2, y: nodeY + nodeH / 2, position: "center" }
      ];

      elements.push(nodeEl);
      placedNodes[nodeName] = nodeEl;
    });

    // 3. Create Connectors/Connections
    connections.forEach((conn, idx) => {
      const source = placedNodes[conn.from];
      const target = placedNodes[conn.to];

      if (source && target) {
        // Create an auto-attaching connector
        const connectorObj: Connector = {
          id: `conn-${idx}-${Date.now()}`,
          sourceId: source.id,
          targetId: target.id,
          label: conn.message,
          labelStyle: typeface,
          arrowStyle: "filled",
          lineStyle: "solid",
          color: getColorValue(conn.color || "grey", "stroke"),
          strokeWidth: 2
        };
        connectors.push(connectorObj);
      }
    });
  }

  return { elements, connectors };
}
