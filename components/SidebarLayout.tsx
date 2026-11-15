"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AgentDeploymentBanner from "@/components/AgentDeploymentBanner";
import TelegramConfigModal from "@/components/TelegramConfigModal";
import SessionSwitcher from "@/components/SessionSwitcher";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname();
  const [readyCount, setReadyCount] = useState<number>(0);
  const [totalLeads, setTotalLeads] = useState<number>(0);

  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          if (data.stats) {
            setReadyCount(data.stats.readyCount || data.stats.funnel?.ready || 0);
            setTotalLeads(data.stats.totalLeads || 0);
          }
        }
      } catch {
        // silent fallback
      }
    }
    void fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDeployAgent = async () => {
    setDeploying(true);
    try {
      await fetch("/api/agent/deploy", { method: "POST" });
    } catch {
      // best-effort
    } finally {
      setDeploying(false);
    }
  };

  const navItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: "Lead Generator Studio",
      href: "/lead-hunter",
      badge: "NEW",
      badgeColor: "bg-orange-500/20 text-orange-600 border-orange-500/30",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      label: "Lead Management",
      href: "/leads",
      badge: totalLeads > 0 ? totalLeads : null,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20H2v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: "Approval Queue",
      href: "/approval-queue",
      badge: readyCount > 0 ? readyCount : null,
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Bulk Ingestion",
      href: "/import",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
    {
      label: "Campaigns",
      href: "/campaigns",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased">
      {/* Telegram Config Modal */}
      <TelegramConfigModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      {/* Sidebar */}
      <aside className="w-64 glass-sidebar flex flex-col fixed inset-y-0 z-40">
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-orange-200/60 bg-white/80">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-orange-500/20">
              LH
            </div>
            <div>
              <span className="font-display font-bold text-base text-slate-900 tracking-tight block leading-tight">
                LeadHunter
              </span>
              <span className="text-[10px] font-mono tracking-wider text-orange-600 uppercase block font-semibold">
                Enterprise AI OS
              </span>
            </div>
          </Link>
        </div>

        {/* AI Agent Status Pill */}
        <div className="px-4 py-3 border-b border-orange-200/60 bg-orange-50/40">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-orange-200/80 text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span className="text-slate-800 font-semibold font-mono text-[11px]">LangGraph Agent</span>
            </div>
            <span className="text-[10px] text-orange-700 bg-orange-100/80 px-1.5 py-0.5 rounded font-mono border border-orange-200 font-semibold">
              Ollama
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold text-orange-600/80 uppercase tracking-widest font-mono">
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-gradient-to-b from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20 font-bold border-t border-white/30"
                    : "text-slate-700 hover:text-orange-600 hover:bg-orange-50/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? "text-white" : "text-slate-400 group-hover:text-orange-500"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge != null && (
                  <span
                    className={`px-2 py-0.5 text-xs font-mono rounded-full font-semibold border ${
                      isActive
                        ? "bg-orange-600/40 text-white border-orange-400/50"
                        : "bg-orange-100 text-orange-800 border-orange-200"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Seeder Trigger Footer */}
        <div className="p-4 border-t border-orange-200/60 bg-orange-50/40">
          <Link
            href="/import"
            className="w-full py-2 px-3 bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 border-t border-white/30 flex items-center justify-center gap-2 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Import Leads
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 glass-header sticky top-0 z-30 px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-display font-semibold text-base text-slate-900 tracking-tight">
              Lead Intelligence & Outreach Management Portal
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Session Switcher - User Session Isolation */}
            <SessionSwitcher />

            {/* Telegram Config Button (Clean SVG symbol, NO emoji) */}
            <button
              onClick={() => setIsTelegramModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-orange-50 text-slate-700 border border-orange-200/80 text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              title="Configure Telegram Notifications"
            >
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Telegram Bot</span>
            </button>

            {/* Universal Deploy Autonomous Agent Button (Clean SVG symbol, NO emoji) */}
            <button
              onClick={handleDeployAgent}
              disabled={deploying}
              className="px-4 py-1.5 bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 border-t border-white/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{deploying ? "Deploying..." : "Deploy Autonomous Agent"}</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-8">
          <AgentDeploymentBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
