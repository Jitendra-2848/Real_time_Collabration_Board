import type { Element } from "../lib/types";
import { v4 as uuid } from "uuid";

export interface Board {
  id: string;
  name: string;
  elements: Element[];
}

export const createBoard = (name: string): Board => ({
  id: uuid(),
  name,
  elements: []
});

export const getActiveBoard = (boards: Board[], activeBoardId: string): Element[] => {
  return boards.find(b => b.id === activeBoardId)?.elements || [];
};

export const updateActiveBoard = (
  boards: Board[],
  activeBoardId: string,
  elements: Element[]
): Board[] => {
  return boards.map(b =>
    b.id === activeBoardId ? { ...b, elements } : b
  );
};

export const deleteBoard = (boards: Board[], boardId: string): Board[] => {
  return boards.filter(b => b.id !== boardId);
};

export const renameBoard = (boards: Board[], boardId: string, name: string): Board[] => {
  return boards.map(b => b.id === boardId ? { ...b, name } : b);
};
