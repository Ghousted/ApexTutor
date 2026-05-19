"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquarePlus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { listSessions, deleteSession, type SessionDoc } from "@/lib/sessions";

export default function SessionsSidebar({
  uid,
  currentSessionId,
  onSelectSession,
  onNewChat,
  refreshKey,
}: {
  uid: string | null;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  /** Bump this number to force a reload of the sessions list. */
  refreshKey?: number;
}) {
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!uid) {
      setSessions([]);
      return;
    }
    setLoading(true);
    try {
      const list = await listSessions(uid);
      setSessions(list);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const handleDelete = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!uid) return;
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    try {
      await deleteSession(uid, sid);
      if (currentSessionId === sid) onNewChat();
      await reload();
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("Couldn't delete that conversation. Try again.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 w-64 shrink-0">
      <div className="p-4 border-b border-slate-200">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && sessions.length === 0 && (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}

        {!loading && sessions.length === 0 && uid && (
          <p className="text-center text-xs text-slate-400 px-4 py-6">
            Your chats will appear here.
          </p>
        )}

        {!uid && (
          <p className="text-center text-xs text-slate-400 px-4 py-6">
            Sign in to save chat history.
          </p>
        )}

        <ul className="flex flex-col gap-1">
          {sessions.map((s) => {
            const active = s.id === currentSessionId;
            return (
              <li key={s.id} className="relative group">
                <button
                  onClick={() => onSelectSession(s.id)}
                  className={cn(
                    "w-full text-left pl-3 pr-9 py-2.5 rounded-lg flex flex-col transition-colors",
                    active
                      ? "bg-indigo-100 text-indigo-900"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <span className="text-sm truncate block">{s.title}</span>
                  <span
                    className={cn(
                      "text-[11px] mt-0.5 block",
                      active ? "text-indigo-600" : "text-slate-400"
                    )}
                  >
                    {relativeTime(s.updatedAt)} · {s.messageCount} msg
                    {s.messageCount === 1 ? "" : "s"}
                  </span>
                </button>
                <button
                  onClick={(e) => handleDelete(s.id, e)}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-opacity",
                    active
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  )}
                  aria-label="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}
