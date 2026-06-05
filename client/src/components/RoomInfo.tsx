import React from "react";
import { LogOut, Users, Info } from "lucide-react";

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
  return (
    <div className="fixed top-24 right-4 z-[100] flex flex-col gap-3.5 rounded-3xl border border-slate-200/60 bg-white/85 p-5 shadow-xl backdrop-blur-md text-sm transition-all duration-300 hover:shadow-2xl w-64">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
        <Info size={16} className="text-slate-500" />
        <span className="font-semibold text-slate-800 truncate">
          Room: {currentRoom?.name || "None"}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-slate-600">
        <div className="truncate">
          Logged in as <span className="font-medium text-slate-900">{username}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
              socketConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="font-medium text-slate-700">
            {socketConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {socketConnected && (
          <div className="flex items-center gap-1.5 text-slate-500 mt-1">
            <Users size={12} />
            <span>
              {peerCount} active collaborator{peerCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-1 border-t border-slate-100 pt-3">
        <button
          onClick={onLeaveRoom}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
        >
          Leave Room
        </button>
        <button
          onClick={onLogout}
          className="flex-1 rounded-xl bg-slate-900 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800 hover:shadow-md active:scale-95 flex items-center justify-center gap-1"
        >
          <LogOut size={12} />
          Logout
        </button>
      </div>
    </div>
  );
};
