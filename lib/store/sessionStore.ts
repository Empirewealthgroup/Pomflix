import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { ModeId } from "@/constants/modes";

const SESSION_KEY = "pom_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

export type ActiveSession = {
  modeId: ModeId;
  modeLabel: string;
  modeIcon: string;
  modeColor: string;
  startTime: number;           // Date.now()
  lastItemId: string | null;
  lastItemName: string | null;
  lastItemProgress: number;    // 0–100
};

type SessionState = {
  currentSession: ActiveSession | null;
  startSession: (
    modeId: ModeId,
    modeLabel: string,
    modeIcon: string,
    modeColor: string
  ) => Promise<void>;
  updateSessionItem: (
    itemId: string,
    itemName: string,
    progress: number
  ) => Promise<void>;
  clearSession: () => Promise<void>;
  loadStoredSession: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,

  startSession: async (modeId, modeLabel, modeIcon, modeColor) => {
    // Keep lastItem if re-entering the same mode within the TTL
    const existing = get().currentSession;
    const sameMode = existing?.modeId === modeId;
    const stillFresh =
      existing ? Date.now() - existing.startTime < SESSION_TTL_MS : false;

    const session: ActiveSession = {
      modeId,
      modeLabel,
      modeIcon,
      modeColor,
      startTime: sameMode && stillFresh ? existing!.startTime : Date.now(),
      lastItemId: sameMode && stillFresh ? existing!.lastItemId : null,
      lastItemName: sameMode && stillFresh ? existing!.lastItemName : null,
      lastItemProgress:
        sameMode && stillFresh ? existing!.lastItemProgress : 0,
    };

    set({ currentSession: session });
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  },

  updateSessionItem: async (itemId, itemName, progress) => {
    const current = get().currentSession;
    if (!current) return;

    const updated: ActiveSession = {
      ...current,
      lastItemId: itemId,
      lastItemName: itemName,
      lastItemProgress: Math.max(0, Math.min(100, Math.round(progress))),
    };

    set({ currentSession: updated });
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(updated));
  },

  clearSession: async () => {
    set({ currentSession: null });
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },

  loadStoredSession: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw) return;
      const session: ActiveSession = JSON.parse(raw);
      // Auto-expire sessions older than TTL
      if (Date.now() - session.startTime > SESSION_TTL_MS) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        return;
      }
      set({ currentSession: session });
    } catch {
      // corrupt data — ignore
    }
  },
}));
