import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const KEY = "pom_onboarding_done";

type OnboardingState = {
  hasSeen: boolean;
  markSeen: () => Promise<void>;
  loadOnboarding: () => Promise<void>;
};

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  hasSeen: false,

  markSeen: async () => {
    await SecureStore.setItemAsync(KEY, "1");
    set({ hasSeen: true });
  },

  loadOnboarding: async () => {
    try {
      const val = await SecureStore.getItemAsync(KEY);
      if (val === "1") set({ hasSeen: true });
    } catch {
      // ignore
    }
  },
}));
