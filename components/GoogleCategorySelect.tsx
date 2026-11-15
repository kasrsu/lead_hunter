"use client";

import { useState } from "react";
import { GOOGLE_CATEGORY_GROUPS, ALL_GOOGLE_CATEGORIES } from "@/lib/constants/googleCategories";

interface GoogleCategorySelectProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  selectedIncludedTypes: string[];
  onIncludedTypesChange: (types: string[]) => void;
}

export default function GoogleCategorySelect({
  selectedCategories,
  onChange,
  selectedIncludedTypes,
  onIncludedTypesChange,
}: GoogleCategorySelectProps) {
  const [customInput, setCustomInput] = useState("");

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      onChange([...selectedCategories, trimmed]);
      setCustomInput("");
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
    onChange(selectedCategories.filter((c) => c !== catToRemove));
  };

  const handleRemoveType = (typeToRemove: string) => {
    onIncludedTypesChange(selectedIncludedTypes.filter((t) => t !== typeToRemove));
  };

  const handleSelectGroupOption = (typeId: string, label: string) => {
    if (!selectedIncludedTypes.includes(typeId)) {
      onIncludedTypesChange([...selectedIncludedTypes, typeId]);
    }
    if (!selectedCategories.includes(label)) {
      onChange([...selectedCategories, label]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Dropdown Selector */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Identify Google Business Categories (Place Types)
        </label>
        <div className="flex gap-2">
          <select
            className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none shadow-xs"
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                const opt = ALL_GOOGLE_CATEGORIES.find((o) => o.id === val);
                if (opt) {
                  handleSelectGroupOption(opt.id, opt.label);
                }
                e.target.value = "";
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              -- Select Official Google Place Category --
            </option>
            {GOOGLE_CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.groupName} label={`📁 ${group.groupName}`}>
                {group.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({opt.id})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Free-Text Category Input */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Or Type Custom Niche Category
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            placeholder="e.g. roofers, clothing stores, plumbers..."
            className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none shadow-xs"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            + Add Tag
          </button>
        </div>
      </div>

      {/* Active Selected Tags */}
      {(selectedCategories.length > 0 || selectedIncludedTypes.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-900 border border-orange-200 rounded-full text-xs font-semibold shadow-2xs"
            >
              🏷️ {cat}
              <button
                type="button"
                onClick={() => handleRemoveCategory(cat)}
                className="hover:text-red-600 font-bold ml-1"
                title="Remove category tag"
              >
                &times;
              </button>
            </span>
          ))}
          {selectedIncludedTypes.map((typeId) => (
            <span
              key={typeId}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-mono font-semibold shadow-2xs"
            >
              📍 place_type:{typeId}
              <button
                type="button"
                onClick={() => handleRemoveType(typeId)}
                className="hover:text-red-600 font-bold ml-1"
                title="Remove place type filter"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
