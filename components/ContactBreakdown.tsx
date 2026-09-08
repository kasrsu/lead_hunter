import React from "react";

interface ContactBreakdownProps {
  breakdown?: {
    hasEmail: number;
    hasPhoneOnly: number;
    hasSocialsOnly: number;
    noDirectContact: number;
  };
}

export default function ContactBreakdown({ breakdown }: ContactBreakdownProps) {
  const data = breakdown || {
    hasEmail: 0,
    hasPhoneOnly: 0,
    hasSocialsOnly: 0,
    noDirectContact: 0,
  };

  const total =
    data.hasEmail + data.hasPhoneOnly + data.hasSocialsOnly + data.noDirectContact || 1;

  const getPct = (n: number) => Math.round((n / total) * 100);

  const items = [
    {
      label: "Direct Email Available",
      count: data.hasEmail,
      pct: getPct(data.hasEmail),
      color: "bg-emerald-500",
      textColor: "text-emerald-400",
      icon: "📧",
    },
    {
      label: "Phone Only (WhatsApp Ready)",
      count: data.hasPhoneOnly,
      pct: getPct(data.hasPhoneOnly),
      color: "bg-amber-500",
      textColor: "text-amber-400",
      icon: "📞",
    },
    {
      label: "Socials Only (IG/FB)",
      count: data.hasSocialsOnly,
      pct: getPct(data.hasSocialsOnly),
      color: "bg-blue-500",
      textColor: "text-blue-400",
      icon: "📱",
    },
    {
      label: "Missing Direct Contact",
      count: data.noDirectContact,
      pct: getPct(data.noDirectContact),
      color: "bg-[#252C3D]",
      textColor: "text-slate-400",
      icon: "⚠️",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Progress bar stack */}
      <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
        {items.map(
          (item, idx) =>
            item.count > 0 && (
              <div
                key={idx}
                className={`h-full ${item.color} transition-all`}
                style={{ width: `${item.pct}%` }}
                title={`${item.label}: ${item.count} (${item.pct}%)`}
              />
            )
        )}
      </div>

      {/* Grid items */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{item.icon}</span>
              <div>
                <span className="font-medium text-slate-300 block text-[11px] leading-tight">
                  {item.label}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {item.pct}% of total
                </span>
              </div>
            </div>
            <span className={`font-mono font-bold text-sm ${item.textColor}`}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
