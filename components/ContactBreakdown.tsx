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
      color: "bg-gradient-to-r from-orange-500 to-amber-500",
      textColor: "text-orange-600",
    },
    {
      label: "Phone Only (WhatsApp Ready)",
      count: data.hasPhoneOnly,
      pct: getPct(data.hasPhoneOnly),
      color: "bg-amber-500",
      textColor: "text-amber-700",
    },
    {
      label: "Socials Only (IG/FB)",
      count: data.hasSocialsOnly,
      pct: getPct(data.hasSocialsOnly),
      color: "bg-orange-400",
      textColor: "text-orange-800",
    },
    {
      label: "Missing Direct Contact",
      count: data.noDirectContact,
      pct: getPct(data.noDirectContact),
      color: "bg-orange-200",
      textColor: "text-slate-500",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Progress bar stack */}
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
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
            className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <div>
                <span className="font-medium text-slate-800 block text-[11px] leading-tight">
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
