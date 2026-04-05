import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

// Bump this string whenever there are user-facing changes worth announcing.
// The modal will show once per unique value, then never again.
export const CURRENT_WHATS_NEW_VERSION = "1.1.0";

export const WHATS_NEW_ITEMS = [
  {
    icon: "◫",
    title: "Browse by genre",
    body: "Movies and TV Shows are now organized by genre — swipe each row or tap See All to explore.",
  },
  {
    icon: "▶",
    title: "Resume where you left off",
    body: "Continue Watching now picks up exactly where you stopped.",
  },
  {
    icon: "◈",
    title: "Now playing info",
    body: "Tap the screen while watching to see the title, year, rating, and progress.",
  },
  {
    icon: "⚡",
    title: "Better playback",
    body: "MKV and other formats that need conversion are automatically transcoded for smooth playback.",
  },
  {
    icon: "✨",
    title: "New Look. Who Dis?",
    body: "Fresh new app icon — same Pomflix you love, now with style.",
  },
] as const;

const KEY = "pom_whats_new_seen_v";

type WhatsNewState = {
  shouldShow: boolean;
  load: () => Promise<void>;
  dismiss: () => Promise<void>;
};

export const useWhatsNewStore = create<WhatsNewState>()((set) => ({
  shouldShow: false,

  load: async () => {
    try {
      const seen = await SecureStore.getItemAsync(KEY);
      if (seen !== CURRENT_WHATS_NEW_VERSION) {
        set({ shouldShow: true });
      }
    } catch {
      // ignore
    }
  },

  dismiss: async () => {
    try {
      await SecureStore.setItemAsync(KEY, CURRENT_WHATS_NEW_VERSION);
    } catch {
      // ignore
    }
    set({ shouldShow: false });
  },
}));
