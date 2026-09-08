"use client";

import React, { useEffect, useState } from "react";
import type { TelegramConfig } from "@/lib/types";

interface TelegramConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelegramConfigModal({ isOpen, onClose }: TelegramConfigModalProps) {
  const [botToken, setBotToken] = useState("8922881742:AAEN_BmuOeUVIpMdPxvLPuQkggjiaRd5VEY");
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/telegram/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          if (data.config.botToken) setBotToken(data.config.botToken);
          if (data.config.chatId) setChatId(data.config.chatId);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAutoDetect = async () => {
    setDetecting(true);
    setNotice(null);
    setIsError(false);

    try {
      const res = await fetch("/api/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken, autoDetect: true }),
      });
      const data = await res.json();
      if (data.detected && data.config?.chatId) {
        setChatId(data.config.chatId);
        setNotice(`✨ ${data.message}`);
        setIsError(false);
      } else {
        setNotice(`⚠️ ${data.message || "No recent messages found."}`);
        setIsError(true);
      }
    } catch (err: any) {
      setNotice(`Error detecting chat: ${err.message}`);
      setIsError(true);
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async (sendTest = false) => {
    if (sendTest) setTesting(true);
    else setSaving(true);
    setNotice(null);
    setIsError(false);

    try {
      const res = await fetch("/api/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken, chatId, sendTest }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save configuration");

      if (sendTest) {
        if (data.testSent) {
          setNotice("✨ Test ping sent successfully to Telegram!");
          setIsError(false);
        } else {
          setNotice("⚠️ Could not send Telegram message. Please check Chat ID.");
          setIsError(true);
        }
      } else {
        setNotice("Telegram configuration saved.");
        setIsError(false);
      }
    } catch (err: any) {
      setNotice(err.message);
      setIsError(true);
    } finally {
      setSaving(false);
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0F131C] border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📱</span>
            <h3 className="font-display font-semibold text-lg text-slate-100">
              Telegram Bot Integration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg font-bold"
          >
            &times;
          </button>
        </div>

        {/* Setup Instructions Helper Box */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-200">
          <div className="font-semibold text-amber-400 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
            <span>💡</span> How to link Telegram in 10 seconds:
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 font-sans leading-relaxed">
            <li>Open Telegram & search for your bot.</li>
            <li>Press <b>/start</b> or send any message to your bot.</li>
            <li>Click <b>"Auto-Detect My Chat ID 🔍"</b> below!</li>
          </ol>
        </div>

        {notice && (
          <div
            className={`p-3 rounded-lg border text-xs font-sans ${
              isError
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {notice}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Telegram Bot Token
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g. 8922881742:AAEN_BmuOeUVIpMdPxvLPuQkggjiaRd5VEY"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:border-amber-500/50 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-mono uppercase text-slate-400">
                Telegram Chat ID
              </label>
              <button
                type="button"
                onClick={handleAutoDetect}
                disabled={detecting || !botToken}
                className="text-[11px] font-mono text-amber-400 hover:underline disabled:opacity-50"
              >
                {detecting ? "Scanning getUpdates..." : "Auto-Detect My Chat ID 🔍"}
              </button>
            </div>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Click 'Auto-Detect My Chat ID' after messaging your bot!"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:border-amber-500/50 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => void handleSave(true)}
            disabled={testing || saving || !botToken || !chatId}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? "Testing..." : "Send Test Ping 📱"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-900 text-slate-400 text-xs rounded-lg hover:text-slate-200"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={saving}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
