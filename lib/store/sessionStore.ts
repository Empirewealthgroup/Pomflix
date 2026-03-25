import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { ModeId } from "@/constants/modes";

const SESSION_KEY = "pom_session";
const RECENT_MOODS_KEY = "pom_recent_moods";
const SESSION_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours
const MAX_RECENT_MOODS = 6;

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
  recentMoodIds: ModeId[];
  startSession: (
    modeId: ModeId,
    modeLabel: string,
    modeIcon: string,
    modeColor: string
  ) => Promise<void>;
  addRecentMoodId: (moodId: ModeId) => Promise<void>;
  clearRecentMoods: () => Promise<void>;
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
  recentMoodIds: [],

  addRecentMoodId: async (moodId) => {
    const existing = get().recentMoodIds.filter((id) => id !== moodId);
    const updated = [moodId, ...existing].slice(0, MAX_RECENT_MOODS);
    set({ recentMoodIds: updated });
    await SecureStore.setItemAsync(RECENT_MOODS_KEY, JSON.stringify(updated));
  },

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

  clearRecentMoods: async () => {
    set({ recentMoodIds: [] });
    await SecureStore.deleteItemAsync(RECENT_MOODS_KEY);
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
      const [sessionRaw, recentRaw] = await Promise.all([
        SecureStore.getItemAsync(SESSION_KEY),
        SecureStore.getItemAsync(RECENT_MOODS_KEY),
      ]);

      if (recentRaw) {
        const parsed = JSON.parse(recentRaw) as ModeId[];
        set({ recentMoodIds: parsed });
      }

      if (!sessionRaw) return;
      const session: ActiveSession = JSON.parse(sessionRaw);
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
