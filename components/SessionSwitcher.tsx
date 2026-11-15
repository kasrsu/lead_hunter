"use client";

import React, { useEffect, useState, useCallback } from "react";

export interface UserSession {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string;
}

export default function SessionSwitcher() {
  const [activeSession, setActiveSession] = useState<UserSession | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.activeSession);
        setSessions(data.sessions || []);
      }
    } catch {
      // best effort fallback
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleSwitchSession = async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch", sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session);
        await fetchSessions();
        setIsOpen(false);
        // Soft refresh the page to reload dashboard/leads under the new session
        window.location.reload();
      }
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSessionName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session);
        setNewSessionName("");
        setIsCreating(false);
        await fetchSessions();
        setIsOpen(false);
        window.location.reload();
      }
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessionId === "sess_default") return;
    if (!confirm("Are you sure you want to delete this session and its campaigns?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchSessions();
        window.location.reload();
      }
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Session Trigger Button - Apple HIG Light Liquid Glass Style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50/50 border border-orange-200/80 text-slate-800 text-xs font-semibold backdrop-blur-md shadow-xs transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400"
        title="Switch Workspace Session"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
        </span>
        <div className="flex flex-col text-left">
          <span className="text-[10px] text-orange-600 font-mono leading-tight uppercase tracking-wider font-semibold">Session</span>
          <span className="font-semibold text-slate-900 truncate max-w-[130px]">
            {activeSession?.name || "Main Workspace"}
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-orange-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-orange-200/80 bg-white/95 backdrop-blur-2xl shadow-xl shadow-orange-500/10 z-50 p-3 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between px-1 pb-2 border-b border-orange-100">
            <div>
              <h4 className="text-xs font-bold text-slate-900 font-display">User Sessions</h4>
              <p className="text-[10px] text-slate-500 font-mono">Isolated campaign workspaces</p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-xs"
            >
              + New
            </button>
          </div>

          {/* New Session Form */}
          {isCreating && (
            <form onSubmit={handleCreateSession} className="p-2.5 bg-orange-50/50 rounded-xl border border-orange-200/80 space-y-2">
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="Session name (e.g. Austin Roofers)"
                className="w-full px-2.5 py-1.5 bg-white border border-orange-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newSessionName.trim()}
                  className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold text-[11px] rounded-lg transition-colors disabled:opacity-50 shadow-xs"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {/* Sessions List */}
          <div className="max-h-56 overflow-y-auto space-y-1">
            {sessions.map((session) => {
              const isCurrent = session.id === activeSession?.id;
              return (
                <div
                  key={session.id}
                  onClick={() => !isCurrent && handleSwitchSession(session.id)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all duration-150 ${
                    isCurrent
                      ? "bg-gradient-to-b from-orange-500 to-amber-600 text-white font-bold border-t border-white/30 shadow-xs"
                      : "hover:bg-orange-50/80 text-slate-700 border border-transparent"
                  }`}
                >
                  <div className="flex flex-col truncate">
                    <span className="truncate flex items-center gap-1.5">
                      {session.name}
                      {session.id === "sess_default" && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                          isCurrent ? "bg-orange-600/40 text-white border border-orange-400/50" : "bg-orange-100 text-orange-800 border border-orange-200"
                        }`}>
                          Default
                        </span>
                      )}
                    </span>
                    <span className={`text-[10px] font-mono truncate ${isCurrent ? "text-orange-100" : "text-slate-400"}`}>
                      ID: {session.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isCurrent && (
                      <span className="text-[10px] font-mono font-semibold text-white">Active</span>
                    )}
                    {session.id !== "sess_default" && (
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className={`p-1 rounded transition-colors ${
                          isCurrent ? "text-orange-200 hover:text-white" : "text-slate-400 hover:text-orange-600"
                        }`}
                        title="Delete session"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
