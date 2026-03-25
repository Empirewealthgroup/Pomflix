import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { ModeId } from "@/constants/modes";

const KEY = (userId: string) => `pom_prefs_${userId}`;

export type FeedbackSensitivity = "strict" | "relaxed";

export type UserPrefs = {
  /** null = no global cap; otherwise cap in minutes */
  maxRuntimeMinutes: number | null;
  /** strict = exclude skipped; relaxed = demote but keep */
  feedbackSensitivity: FeedbackSensitivity;
  /** Up to 3 moods always shown first on home */
  pinnedMoodIds: ModeId[];
  /** Moods hidden from suggestions and View All */
  hiddenMoodIds: ModeId[];
};

const DEFAULT_PREFS: UserPrefs = {
  maxRuntimeMinutes: null,
  feedbackSensitivity: "strict",
  pinnedMoodIds: [],
  hiddenMoodIds: [],
};

type SettingsState = {
  prefs: UserPrefs;
  loadPrefs: (userId: string) => Promise<void>;
  updatePrefs: (userId: string, patch: Partial<UserPrefs>) => Promise<void>;
  togglePinnedMood: (userId: string, moodId: ModeId) => Promise<void>;
  toggleHiddenMood: (userId: string, moodId: ModeId) => Promise<void>;
};

async function persist(userId: string, prefs: UserPrefs) {
  await SecureStore.setItemAsync(KEY(userId), JSON.stringify(prefs));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  prefs: { ...DEFAULT_PREFS },

  loadPrefs: async (userId) => {
    try {
      const raw = await SecureStore.getItemAsync(KEY(userId));
      if (raw) {
        const stored = JSON.parse(raw) as Partial<UserPrefs>;
        set({ prefs: { ...DEFAULT_PREFS, ...stored } });
      } else {
        set({ prefs: { ...DEFAULT_PREFS } });
      }
    } catch {
      set({ prefs: { ...DEFAULT_PREFS } });
    }
  },

  updatePrefs: async (userId, patch) => {
    const updated = { ...get().prefs, ...patch };
    set({ prefs: updated });
    await persist(userId, updated);
  },

  togglePinnedMood: async (userId, moodId) => {
    const current = get().prefs.pinnedMoodIds;
    const isPinned = current.includes(moodId);
    let updated: ModeId[];
    if (isPinned) {
      updated = current.filter((id) => id !== moodId);
    } else if (current.length < 3) {
      updated = [...current, moodId];
    } else {
      // Already at cap — replace oldest
      updated = [...current.slice(1), moodId];
    }
    await get().updatePrefs(userId, { pinnedMoodIds: updated });
  },

  toggleHiddenMood: async (userId, moodId) => {
    const current = get().prefs.hiddenMoodIds;
    const isHidden = current.includes(moodId);
    const updated = isHidden
      ? current.filter((id) => id !== moodId)
      : [...current, moodId];
    // Can't hide a pinned mood
    const pinnedClean = get().prefs.pinnedMoodIds.filter((id) => id !== moodId);
    await get().updatePrefs(userId, {
      hiddenMoodIds: updated,
      pinnedMoodIds: pinnedClean,
    });
  },
}));
