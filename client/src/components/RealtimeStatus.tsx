import React from "react";
import { Wifi, WifiOff } from "lucide-react";

interface Props {
  socketConnected: boolean;
  peerCount: number;
  SOCKET_URL: string;
}

export const RealtimeStatus: React.FC<Props> = ({
  socketConnected,
  peerCount,
  SOCKET_URL,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed left-4 top-24 z-40 flex items-center justify-center rounded-full border border-slate-200/50 bg-white/90 p-2.5 shadow-lg backdrop-blur-md hover:bg-slate-50 active:scale-95 transition-all duration-200"
        title="Show Realtime Sync Details"
      >
        <div
          className={`w-3 h-3 rounded-full ${
            socketConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
          }`}
        />
      </button>
    );
  }

  return (
    <div className="fixed left-4 top-24 z-40 rounded-2xl border border-slate-200/50 bg-white/85 px-4 py-3 text-xs shadow-lg backdrop-blur-md transition-all duration-300 w-52 flex flex-col gap-1 text-slate-700">
      <div className="font-semibold text-slate-900 flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1">
        <div className="flex items-center gap-1.5">
          {socketConnected ? (
            <Wifi size={14} className="text-emerald-500" />
          ) : (
            <WifiOff size={14} className="text-rose-500" />
          )}
          Realtime Sync
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-slate-400 hover:text-slate-600 transition-colors px-1.5 py-0.5 hover:bg-slate-100 rounded-md font-medium"
        >
          Hide
        </button>
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span>Connected:</span>
        <span
          className={`font-semibold ${
            socketConnected ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {socketConnected ? "Yes" : "No"}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span>Peers:</span>
        <span className="font-semibold text-slate-900">{peerCount}</span>
      </div>
      <div className="text-[10px] text-slate-400 mt-1.5 truncate" title={SOCKET_URL}>
        Server: {SOCKET_URL}
      </div>
    </div>
  );
};
