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
  return (
    <div className="fixed left-4 top-24 z-40 pointer-events-none rounded-2xl border border-slate-200/50 bg-white/85 px-4 py-3 text-xs shadow-lg backdrop-blur-md transition-all duration-300 w-52 flex flex-col gap-1 text-slate-700">
      <div className="font-semibold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-1">
        {socketConnected ? (
          <Wifi size={14} className="text-emerald-500" />
        ) : (
          <WifiOff size={14} className="text-rose-500" />
        )}
        Realtime Sync
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
