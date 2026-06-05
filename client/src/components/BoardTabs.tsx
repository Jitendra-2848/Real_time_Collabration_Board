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
    <div className="fixed top-0 left-0 right-0 h-10 bg-slate-900 flex items-center gap-1.5 px-4 z-[100] border-b border-slate-800 shadow-md overflow-x-auto select-none">
      <div className="flex items-center gap-1 text-slate-400 mr-2 border-r border-slate-700 pr-3">
        <Layout size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">Canvas Boards</span>
      </div>

      <div className="flex items-end h-full pt-1.5 gap-1 flex-1 overflow-x-auto scrollbar-none">
        {boards.map((board) => {
          const isActive = board.id === activeBoardId;
          return (
            <button
              key={board.id}
              onClick={() => onSelectBoard(board.id)}
              className={`px-4 py-1.5 text-xs font-medium rounded-t-xl transition-all flex items-center gap-1.5 border-t border-x ${
                isActive
                  ? "bg-slate-50 border-slate-200 text-slate-800 font-bold scale-100 z-10 shadow-sm"
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
        className="p-1 hover:bg-slate-800 hover:text-white rounded-lg text-slate-400 transition-all active:scale-90"
        title="Add new board"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};
