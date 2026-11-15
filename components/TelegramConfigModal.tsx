"use client";

import { useEffect, useState } from "react";

interface TelegramConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelegramConfigModal({ isOpen, onClose }: TelegramConfigModalProps) {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [autoSendOnReady, setAutoSendOnReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      void loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/telegram-config");
      if (!res.ok) return;
      const data = await res.json();
      if (data.config) {
        setBotToken(data.config.botToken || "");
        setChatId(data.config.chatId || "");
        setEnabled(Boolean(data.config.enabled));
        setAutoSendOnReady(Boolean(data.config.autoSendOnReady));
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch("/api/telegram-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken, chatId, enabled, autoSendOnReady }),
      });
      if (res.ok) {
        setSavedMsg("Settings saved! Telegram bot is isolated to this workspace session.");
        setTimeout(() => setSavedMsg(""), 3000);
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
            ✈️ Dedicated Telegram Bot Setup
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-lg"
          >
            &times;
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          Configure a isolated, session-specific Telegram bot to receive real-time approval alerts & notifications for this workspace without data mixing.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase">Bot Token</label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase">Chat ID</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 987654321 or -10012345678"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="accent-orange-500 w-4 h-4 rounded"
              />
              Enable Telegram Approval Notifications for this Workspace
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSendOnReady}
                onChange={(e) => setAutoSendOnReady(e.target.checked)}
                className="accent-orange-500 w-4 h-4 rounded"
              />
              Auto-send Telegram Message when AI Opener is Ready
            </label>
          </div>

          {savedMsg && (
            <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-center">
              {savedMsg}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Telegram Credentials"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
