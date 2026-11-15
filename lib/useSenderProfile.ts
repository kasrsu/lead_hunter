"use client";

import { useEffect, useState } from "react";
import type { SenderProfile } from "./types";

/**
 * Client-side holder for the sender profile. Persisted to localStorage so it
 * survives navigation between the dashboard, kanban and lead-detail screens.
 */

const STORAGE_KEY = "leadhunt.sender";

export const DEFAULT_SENDER: SenderProfile = {
  senderName: "EVO Solutions Outreach",
  senderCompany: "EVO Solutions",
  offerDescription: "Digital storefront optimization, dynamic menu pricing & lead intelligence",
  senderEmail: "hello@evosolutions.lk",
};

export function useSenderProfile(): [SenderProfile, (next: SenderProfile) => void] {
  const [sender, setSender] = useState<SenderProfile>(DEFAULT_SENDER);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.senderName || parsed.senderCompany) {
          setSender({ ...DEFAULT_SENDER, ...parsed });
        }
      }
    } catch {
      // storage fallback
    }
  }, []);

  function save(next: SenderProfile) {
    setSender(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage fallback
    }
  }

  return [sender, save];
}
