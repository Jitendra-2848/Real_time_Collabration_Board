import type { Element } from "../lib/types";
import { v4 as uuid } from "uuid";

export const duplicateSelected = (elements: Element[]): Element[] => {
  const selected = elements.filter(el => el.isSelected && !el.locked);
  if (selected.length === 0) return elements;
  const dupes = selected.map(el => ({
    ...el,
    id: uuid(),
    x: el.x + 20,
    y: el.y + 20,
    isSelected: false
  }));
  return [...elements, ...dupes];
};

export const pasteElements = (elements: Element[], clipboard: Element[]): Element[] => {
  if (clipboard.length === 0) return elements;
  const pasted = clipboard.map(el => ({
    ...el,
    id: uuid(),
    x: el.x + 20,
    y: el.y + 20,
    isSelected: true
  }));
  const deselected = elements.map(el => ({ ...el, isSelected: false }));
  return [...deselected, ...pasted];
};

export const toggleLock = (elements: Element[]): Element[] => {
  return elements.map(el =>
    el.isSelected ? { ...el, locked: !el.locked } : el
  );
};

export const groupSelected = (elements: Element[], nextGroupId: number): { elements: Element[]; nextGroupId: number } => {
  const selected = elements.filter(el => el.isSelected);
  if (selected.length < 2) return { elements, nextGroupId };
  
  const groupId = `group-${nextGroupId}`;
  return {
    elements: elements.map(el =>
      el.isSelected ? { ...el, groupId, isSelected: false } : el
    ),
    nextGroupId: nextGroupId + 1
  };
};

export const ungroupSelected = (elements: Element[]): Element[] => {
  const selected = elements.filter(el => el.isSelected);
  if (selected.length === 0) return elements;
  
  const groupIds = new Set(selected.map(el => el.groupId).filter(Boolean));
  if (groupIds.size === 0) return elements;
  
  return elements.map(el =>
    (el.groupId && groupIds.has(el.groupId)) ? { ...el, groupId: undefined } : el
  );
};
