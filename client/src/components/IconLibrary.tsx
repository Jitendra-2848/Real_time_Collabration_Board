import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import * as SimpleIcons from "simple-icons";

type SimpleIconData = {
  title: string;
  slug: string;
  hex: string;
  path: string;
  svg: string;
};

const ALL_ICONS: SimpleIconData[] = Object.values(SimpleIcons).filter(
  (item: any): item is SimpleIconData =>
    item &&
    typeof item === "object" &&
    typeof item.title === "string" &&
    typeof item.path === "string" &&
    typeof item.hex === "string"
);

const SYSTEM_ICONS: SimpleIconData[] = [
  {
    title: "Load Balancer",
    slug: "load-balancer",
    hex: "2563EB",
    path: "M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.2L19.5 8 12 11.8 4.5 8 12 4.2zM4 9.6l7 3.5v6.7l-7-3.5V9.6zm16 0v6.7l-7 3.5v-6.7l7-3.5z",
    svg: "",
  },
  {
    title: "Server",
    slug: "server",
    hex: "64748B",
    path: "M3 3h18v6H3V3zm2 2v2h14V5H5zm-2 8h18v8H3v-8zm2 2v4h14v-4H5zm2 1h2v2H7v-2zm0-10h2v1H7V6z",
    svg: "",
  },
  {
    title: "Database",
    slug: "database",
    hex: "7C3AED",
    path: "M12 2C7 2 3 3.8 3 6v12c0 2.2 4 4 9 4s9-1.8 9-4V6c0-2.2-4-4-9-4zm0 2c4.2 0 7 1.2 7 2s-2.8 2-7 2-7-1.2-7-2 2.8-2 7-2zm7 5v3c0 .8-2.8 2-7 2s-7-1.2-7-2V9c1.6 1 4.1 1.5 7 1.5S17.4 10 19 9zm0 6v3c0 .8-2.8 2-7 2s-7-1.2-7-2v-3c1.6 1 4.1 1.5 7 1.5s5.4-.5 7-1.5z",
    svg: "",
  },
  {
    title: "Queue",
    slug: "queue",
    hex: "F97316",
    path: "M4 5h16v3H4V5zm0 5h16v3H4v-3zm0 5h16v3H4v-3z",
    svg: "",
  },
  {
    title: "Cache",
    slug: "cache",
    hex: "EF4444",
    path: "M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z",
    svg: "",
  },
  {
    title: "Client",
    slug: "client",
    hex: "06B6D4",
    path: "M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9c0-4 3.5-7 8-7s8 3 8 7H4z",
    svg: "",
  },
];

const COMBINED_ICONS = [...SYSTEM_ICONS, ...ALL_ICONS];

interface Props {
  onSelect: (icon: SimpleIconData) => void;
  onClose: () => void;
}

export const IconLibrary: React.FC<Props> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      return COMBINED_ICONS.slice(0, 250);
    }

    return COMBINED_ICONS.filter((icon) =>
      icon.title.toLowerCase().includes(q)
    ).slice(0, 250);
  }, [search]);

  return (
    <div className="fixed left-20 top-20 z-50 flex max-h-[80vh] w-[460px] flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-gray-700">
          Icon Library ({COMBINED_ICONS.length}+)
        </h3>

        <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-50 p-2">
        <Search size={16} className="text-gray-400" />
        <input
          placeholder="Search React, Docker, AWS, database..."
          className="w-full bg-transparent text-sm outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid flex-1 grid-cols-6 gap-2 overflow-y-auto pr-1">
        {filtered.map((icon) => (
          <button
            key={`${icon.slug}-${icon.title}`}
            onClick={() => onSelect(icon)}
            title={icon.title}
            className="flex flex-col items-center justify-center rounded-xl border border-transparent p-2 transition-all hover:border-blue-200 hover:bg-blue-50"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6">
              <path fill={`#${icon.hex}`} d={icon.path} />
            </svg>

            <span className="mt-1 w-full truncate text-center text-[7px] text-gray-500">
              {icon.title}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 border-t pt-2 text-center text-xs text-gray-400">
        Showing {filtered.length} icons
      </div>
    </div>
  );
};