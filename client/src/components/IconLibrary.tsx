import React, { useState } from "react";
import { Search, X } from "lucide-react";
import * as Si from "react-icons/si";
import ReactDOMServer from "react-dom/server";

const TECH_ICONS = [
  { name: "React", icon: Si.SiReact, color: "#61DAFB" },
  { name: "Node.js", icon: Si.SiNodedotjs, color: "#339933" },
  { name: "Docker", icon: Si.SiDocker, color: "#2496ED" },
  { name: "Kubernetes", icon: Si.SiKubernetes, color: "#326CE5" },
  { name: "MongoDB", icon: Si.SiMongodb, color: "#47A248" },
  { name: "PostgreSQL", icon: Si.SiPostgresql, color: "#4169E1" },
  { name: "Redis", icon: Si.SiRedis, color: "#DC382D" },
  { name: "MySQL", icon: Si.SiMysql, color: "#4479A1" },
  { name: "Nginx", icon: Si.SiNginx, color: "#009639" },
  { name: "Apache", icon: Si.SiApache, color: "#D22128" },
  { name: "GraphQL", icon: Si.SiGraphql, color: "#E10098" },
  { name: "Kafka", icon: Si.SiApachekafka, color: "#231F20" },
  { name: "RabbitMQ", icon: Si.SiRabbitmq, color: "#FF6600" },
  { name: "Elasticsearch", icon: Si.SiElasticsearch, color: "#005571" },
  { name: "Prometheus", icon: Si.SiPrometheus, color: "#E6522C" },
  { name: "Grafana", icon: Si.SiGrafana, color: "#F46800" },
  { name: "Jenkins", icon: Si.SiJenkins, color: "#D24939" },
  { name: "GitHub", icon: Si.SiGithub, color: "#181717" },
  { name: "GitLab", icon: Si.SiGitlab, color: "#FC6D26" },
  { name: "TypeScript", icon: Si.SiTypescript, color: "#3178C6" },
  { name: "JavaScript", icon: Si.SiJavascript, color: "#F7DF1E" },
  { name: "HTML5", icon: Si.SiHtml5, color: "#E34F26" },
  { name: "CSS3", icon: Si.SiCss, color: "#1572B6" },
  { name: "Git", icon: Si.SiGit, color: "#F05032" },
  { name: "VS Code", icon: Si.SiVscodium, color: "#0078D7" },
  { name: "Figma", icon: Si.SiFigma, color: "#F24E1E" },
  { name: "Tailwind", icon: Si.SiTailwindcss, color: "#38B2AC" },
  { name: "Cloudflare", icon: Si.SiCloudflare, color: "#F38020" },
  { name: "Linux", icon: Si.SiLinux, color: "#FCC624" },
  { name: "Google Cloud", icon: Si.SiGooglecloud, color: "#4285F4" },
];

const extractPathData = (IconComponent: React.ComponentType) => {
  try {
    const svgString = ReactDOMServer.renderToStaticMarkup(<IconComponent />);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return { viewBox: "0 0 24 24", paths: [] };
    
    const viewBox = svg.getAttribute("viewBox") || "0 0 24 24";
    const paths = Array.from(svg.querySelectorAll("path, circle, rect"))
      .map((el) => el.getAttribute("d") || el.outerHTML)
      .filter(Boolean);
      
    return { viewBox, paths };
  } catch (e) {
    return { viewBox: "0 0 24 24", paths: [] };
  }
};

interface Props {
  onSelect: (icon: { name: string; color: string; svgPaths: string[]; viewBox: string }) => void;
  onClose: () => void;
}

export const IconLibrary: React.FC<Props> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState("");

  const filtered = TECH_ICONS.filter((icon) =>
    icon.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed sm:left-20 sm:top-20 top-1/2 left-1/2 sm:-translate-x-0 sm:-translate-y-0 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] sm:w-96 bg-white shadow-2xl rounded-2xl border border-gray-200 p-4 z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-700">Component Library</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg mb-4">
        <Search size={16} className="text-gray-400" />
        <input
          placeholder="Search icons..."
          className="bg-transparent text-sm outline-none w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid flex-1 grid-cols-5 gap-3 overflow-y-auto pr-1 max-h-80">
        {filtered.map((icon) => {
          const svgData = extractPathData(icon.icon);
          return (
            <button
              key={icon.name}
              onClick={() => onSelect({ 
                name: icon.name, 
                color: icon.color, 
                svgPaths: svgData.paths, 
                viewBox: svgData.viewBox 
              })}
              className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3 transition-all hover:border-blue-300 hover:bg-blue-50"
              style={{ minHeight: 84 }}
            >
              <icon.icon size={26} color={icon.color} />
              <span className="mt-2 w-full truncate text-center text-[9px] text-gray-600">
                {icon.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};