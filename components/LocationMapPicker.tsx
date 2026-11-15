"use client";

import { useState } from "react";

interface MapBounds {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
}

interface LocationMapPickerProps {
  location: string;
  onLocationChange: (loc: string) => void;
  mapBounds?: MapBounds;
  onMapBoundsChange: (bounds: MapBounds) => void;
}

export default function LocationMapPicker({
  location,
  onLocationChange,
  mapBounds,
  onMapBoundsChange,
}: LocationMapPickerProps) {
  const [showMapModal, setShowMapModal] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(
    mapBounds?.radiusMeters ? mapBounds.radiusMeters / 1000 : 10
  );

  const handleRadiusChange = (newKm: number) => {
    setRadiusKm(newKm);
    onMapBoundsChange({
      ...mapBounds,
      radiusMeters: newKm * 1000,
    });
  };

  return (
    <div className="space-y-4">
      {/* Text Location Bar */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Target Location (City, State, Zip, or Region)
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="e.g. Chicago, IL or 90210"
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none shadow-xs"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>

          <button
            type="button"
            onClick={() => setShowMapModal(!showMapModal)}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              showMapModal
                ? "bg-orange-50 border-orange-300 text-orange-700"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            🗺️ {showMapModal ? "Hide Map Area" : "Visual Map Radius"}
          </button>
        </div>
      </div>

      {/* Embedded Radius & Interactive Area Controls */}
      {showMapModal && (
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-4 shadow-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-xs font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Parameterized Search Radius & Coordinates
            </h4>
            <span className="text-xs font-mono text-slate-400">
              Radius: {radiusKm} km ({radiusKm * 1000}m)
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max="50"
              value={radiusKm}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>1 km (Tight City Center)</span>
              <span>10 km (Default Metro)</span>
              <span>50 km (Regional Radius)</span>
            </div>
          </div>

          <div className="h-44 rounded-xl bg-slate-800/80 border border-slate-700/60 overflow-hidden relative flex flex-col items-center justify-center p-4 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(#fb923c_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
            <div className="relative z-10 space-y-2">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 border-2 border-orange-400 flex items-center justify-center mx-auto text-xl animate-bounce">
                📍
              </div>
              <p className="text-xs font-bold text-slate-200">
                Visual Geographic Target: {location || "Selected Area"}
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Google Places API (New) will bias Text Search results within a {radiusKm}km circle around {location || "target location"}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
