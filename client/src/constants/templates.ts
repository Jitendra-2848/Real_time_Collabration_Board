import type { Element } from "../lib/types";

export const TEMPLATES: Record<string, Element[]> = {
  "Blank": [],
  "Wireframe": [
    { id:"1", tool:"rect", x:50, y:50, width:300, height:400, color:"#333", fillColor:"#e5e7eb", strokeWidth:1 },
    { id:"2", tool:"rect", x:400, y:50, width:200, height:200, color:"#333", fillColor:"#bfdbfe", strokeWidth:1 },
    { id:"3", tool:"rect", x:400, y:270, width:200, height:180, color:"#333", fillColor:"#bbf7d0", strokeWidth:1 },
    { id:"4", tool:"text", x:60, y:60, width:280, height:30, color:"#000", strokeWidth:0, text:"Header" },
    { id:"5", tool:"text", x:410, y:60, width:180, height:30, color:"#000", strokeWidth:0, text:"Sidebar" },
  ],
  "Mindmap": [
    { id:"1", tool:"circle", x:350, y:200, width:100, height:80, color:"#2563eb", fillColor:"#dbeafe", strokeWidth:2, text:"Idea" },
    { id:"2", tool:"line", x:450, y:240, width:50, height:-80, color:"#999", strokeWidth:2 },
    { id:"3", tool:"rect", x:500, y:120, width:100, height:60, color:"#333", fillColor:"#fef08a", strokeWidth:1, text:"Branch 1" },
    { id:"4", tool:"line", x:450, y:240, width:50, height:80, color:"#999", strokeWidth:2 },
    { id:"5", tool:"rect", x:500, y:300, width:100, height:60, color:"#333", fillColor:"#bbf7d0", strokeWidth:1, text:"Branch 2" },
  ],
  "Kanban": [
    { id:"1", tool:"rect", x:30, y:40, width:300, height:500, color:"#333", fillColor:"#f3f4f6", strokeWidth:1 },
    { id:"2", tool:"rect", x:360, y:40, width:300, height:500, color:"#333", fillColor:"#f3f4f6", strokeWidth:1 },
    { id:"3", tool:"rect", x:690, y:40, width:300, height:500, color:"#333", fillColor:"#f3f4f6", strokeWidth:1 },
    { id:"4", tool:"text", x:120, y:50, width:100, height:30, color:"#000", strokeWidth:0, text:"To Do" },
    { id:"5", tool:"text", x:450, y:50, width:100, height:30, color:"#000", strokeWidth:0, text:"In Progress" },
    { id:"6", tool:"text", x:780, y:50, width:100, height:30, color:"#000", strokeWidth:0, text:"Done" },
  ],
  "SWOT Analysis": [
    { id:"1", tool:"text", x:200, y:30, width:100, height:30, color:"#000", strokeWidth:0, text:"SWOT" },
    { id:"2", tool:"rect", x:30, y:70, width:400, height:200, color:"#333", fillColor:"#dcfce7", strokeWidth:1 },
    { id:"3", tool:"rect", x:450, y:70, width:400, height:200, color:"#333", fillColor:"#fef08a", strokeWidth:1 },
    { id:"4", tool:"rect", x:30, y:290, width:400, height:200, color:"#333", fillColor:"#dbeafe", strokeWidth:1 },
    { id:"5", tool:"rect", x:450, y:290, width:400, height:200, color:"#333", fillColor:"#fecaca", strokeWidth:1 },
    { id:"6", tool:"text", x:180, y:80, width:100, height:30, color:"#000", strokeWidth:0, text:"Strengths" },
    { id:"7", tool:"text", x:620, y:80, width:100, height:30, color:"#000", strokeWidth:0, text:"Weaknesses" },
    { id:"8", tool:"text", x:180, y:300, width:100, height:30, color:"#000", strokeWidth:0, text:"Opportunities" },
    { id:"9", tool:"text", x:620, y:300, width:100, height:30, color:"#000", strokeWidth:0, text:"Threats" },
  ],
  "Nested Blocks": [
    { id: "nest-1", tool: "rect", x: 100, y: 100, width: 450, height: 350, color: "#3b82f6", fillColor: "transparent", strokeWidth: 2, text: "Outer Container (Transparent)", fontFamily: "Inter, sans-serif", bold: true, fontSize: 16 },
    { id: "nest-2", tool: "rect", x: 140, y: 180, width: 160, height: 120, color: "#0f172a", fillColor: "#dbeafe", strokeWidth: 1.5, text: "Inner Block A", fontFamily: "Inter, sans-serif", fontSize: 13 },
    { id: "nest-3", tool: "circle", x: 340, y: 180, width: 140, height: 120, color: "#0f172a", fillColor: "#bbf7d0", strokeWidth: 1.5, text: "Inner Block B", fontFamily: "Inter, sans-serif", fontSize: 13 },
  ],
};
