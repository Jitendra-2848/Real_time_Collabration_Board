import React, { useState, useRef, useEffect } from "react";
import { Send, MessageSquare } from "lucide-react";

interface Props {
  messages: any[];
  onSendMessage: (message: string) => void;
  username: string;
}

export const ChatPanel: React.FC<Props> = ({
  messages,
  onSendMessage,
  username,
}) => {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    if (text.trim()) {
      onSendMessage(text.trim());
      setText("");
    }
  };

  return (
    <div className="fixed sm:right-4 sm:top-24 right-0 bottom-0 sm:bottom-auto sm:w-80 w-full h-[50vh] bg-white/90 border-t sm:border border-slate-200/60 shadow-2xl rounded-t-3xl sm:rounded-3xl p-4 flex flex-col backdrop-blur-md transition-all duration-300 hover:shadow-3xl z-[60]">
      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3 flex-shrink-0">
        <MessageSquare size={16} className="text-slate-500" />
        Room Chat
      </h3>

      <div
        ref={listRef}
        className="space-y-3 mb-3 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200"
      >
        {(!messages || messages.length === 0) && (
          <div className="text-slate-400 text-xs text-center mt-10">
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.username === username;
          return (
            <div
              key={m.id || m.created_at}
              className={`flex flex-col gap-1 max-w-[85%] ${
                isMe ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="font-medium text-slate-500">{m.username}</span>
                <span>•</span>
                <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div
                className={`text-xs px-3.5 py-2 rounded-2xl shadow-sm leading-relaxed break-words ${
                  isMe
                    ? "bg-slate-900 text-white rounded-tr-none"
                    : "bg-slate-100 text-slate-800 rounded-tl-none"
                }`}
              >
                {m.message}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 flex-shrink-0 border-t border-slate-100 pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-slate-400 focus:outline-none bg-slate-50/50"
          placeholder="Write a message..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        <button
          onClick={handleSubmit}
          className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white p-2.5 transition-all active:scale-90 shadow-md flex items-center justify-center flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
