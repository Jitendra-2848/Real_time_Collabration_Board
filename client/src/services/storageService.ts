import type { Element } from "../lib/types";

export const loadFromLocalStorage = (): { elements: Element[]; boards: any; activeBoardId: string } | null => {
  const saved = localStorage.getItem("whiteboard-autosave");
  if (!saved) return null;

  try {
    const data = JSON.parse(saved);
    return data;
  } catch {
    return null;
  }
};

export const saveToLocalStorage = (
  elements: Element[],
  boards: any,
  activeBoardId: string
): void => {
  localStorage.setItem(
    "whiteboard-autosave",
    JSON.stringify({ elements, boards, activeBoardId })
  );
};
