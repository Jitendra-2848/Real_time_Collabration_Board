import React from "react";
import { Plus, Layout } from "lucide-react";
import * as BoardService from "../services/boardService";

interface Props {
  boards: BoardService.Board[];
  activeBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onAddBoard: () => void;
}

export const BoardTabs: React.FC<Props> = ({
  boards,
  activeBoardId,
  onSelectBoard,
  onAddBoard,
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 h-9 sm:h-10 bg-slate-900 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 z-[100] border-b border-slate-800 shadow-md overflow-x-auto select-none">
      <div className="flex items-center gap-1 text-slate-400 mr-1 sm:mr-2 border-r border-slate-700 pr-2 sm:pr-3 shrink-0">
        <Layout size={12} />
        <span className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider hidden sm:inline">Canvas Boards</span>
      </div>

      <div className="flex items-end h-full pt-1 sm:pt-1.5 gap-0.5 sm:gap-1 flex-1 overflow-x-auto scrollbar-none">
        {boards.map((board) => {
          const isActive = board.id === activeBoardId;
          return (
            <button
              key={board.id}
              onClick={() => onSelectBoard(board.id)}
              className={`px-2 sm:px-4 py-1 sm:py-1.5 text-[9px] sm:text-xs font-medium rounded-t-lg sm:rounded-t-xl transition-all flex items-center gap-1 sm:gap-1.5 border-t border-x whitespace-nowrap ${
                isActive
                  ? "bg-slate-50 border-slate-200 text-slate-800 font-bold z-10 shadow-sm"
                  : "bg-slate-800/60 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {board.name}
            </button>
          );
        })}
      </div>

      <button
        onClick={onAddBoard}
        className="p-1 hover:bg-slate-800 hover:text-white rounded-lg text-slate-400 transition-all active:scale-90 shrink-0"
        title="Add new board"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};