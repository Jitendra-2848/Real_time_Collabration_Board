import React from "react";
import { LogOut, Users, Info, X } from "lucide-react";
import toast from 'react-hot-toast';

interface Props {
  currentRoom: { id: string | number; name: string } | null;
  username: string;
  socketConnected: boolean;
  peerCount: number;
  onLeaveRoom: () => void;
  onLogout: () => void;
}

export const RoomInfo: React.FC<Props> = ({
  currentRoom,
  username,
  socketConnected,
  peerCount,
  onLeaveRoom,
  onLogout,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed top-14 right-2 sm:top-24 sm:right-4 z-[100] flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200/60 bg-white/90 px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-lg backdrop-blur-md text-[10px] sm:text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all duration-200"
        title="Show Room Details"
      >
        <Info size={12} className="text-indigo-500" />
        <span className="truncate max-w-[60px] sm:max-w-none">{currentRoom?.name || "None"}</span>
      </button>
    );
  }

  return (
    <div className="fixed top-14 right-2 sm:top-24 sm:right-4 z-[100] flex flex-col gap-2 sm:gap-3.5 rounded-2xl sm:rounded-3xl border border-slate-200/60 bg-white/85 p-3 sm:p-5 shadow-xl backdrop-blur-md text-[11px] sm:text-sm transition-all duration-300 hover:shadow-2xl w-[200px] sm:w-64">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 sm:pb-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Info size={14} className="text-slate-500" />
          <span className="font-semibold text-slate-800 truncate max-w-[100px] sm:max-w-[130px]" title={currentRoom?.name || "None"}>
            Room: {currentRoom?.name || "None"}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-1.5 py-0.5 hover:bg-slate-100 rounded-md font-medium"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs text-slate-600">
        <div className="truncate">
          Logged in as <span className="font-medium text-slate-900">{username}</span>
        </div>
        {currentRoom?.id && (
          <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] mt-0.5 sm:mt-1 bg-slate-50 p-1 sm:p-1.5 rounded-lg border border-slate-100">
            <span className="font-mono text-slate-500 truncate">ID: {currentRoom.id}</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(String(currentRoom.id));
                toast.success("Room ID copied!");
              }} 
              className="text-[9px] sm:text-[10px] text-blue-600 hover:text-blue-800 font-bold ml-1 active:scale-95"
            >
              Copy
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
          <div
            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-colors duration-500 ${
              socketConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="font-medium text-slate-700">
            {socketConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {socketConnected && (
          <div className="flex items-center gap-1 sm:gap-1.5 text-slate-500 mt-0.5 sm:mt-1">
            <Users size={10} />
            <span>
              {peerCount} active collaborator{peerCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 border-t border-slate-100 pt-2 sm:pt-3">
        <button
          onClick={onLeaveRoom}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
        >
          Leave Room
        </button>
        <button
          onClick={onLogout}
          className="flex-1 rounded-xl bg-slate-900 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium text-white transition-all hover:bg-slate-800 hover:shadow-md active:scale-95 flex items-center justify-center gap-1"
        >
          <LogOut size={10} />
          Logout
        </button>
      </div>
    </div>
  );
};