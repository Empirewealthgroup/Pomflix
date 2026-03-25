import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type FeedbackRating = "perfect" | "okay" | "skip";

const FEEDBACK_KEY = "pom_feedback_map";

type FeedbackState = {
  feedbackMap: Record<string, FeedbackRating>;
  setFeedback: (itemId: string, rating: FeedbackRating) => void;
  getFeedback: (itemId: string) => FeedbackRating | undefined;
  isSkipped: (itemId: string) => boolean;
  loadFeedback: () => Promise<void>;
  clearFeedback: () => Promise<void>;
};

export const useFeedbackStore = create<FeedbackState>()((set, get) => ({
  feedbackMap: {},

  setFeedback: (itemId, rating) => {
    const updated = { ...get().feedbackMap, [itemId]: rating };
    set({ feedbackMap: updated });
    // In-memory update is instant; disk write is fire-and-forget
    AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(updated)).catch(() => {});
  },

  getFeedback: (itemId) => get().feedbackMap[itemId],

  isSkipped: (itemId) => get().feedbackMap[itemId] === "skip",

  loadFeedback: async () => {
    try {
      const raw = await AsyncStorage.getItem(FEEDBACK_KEY);
      if (raw) set({ feedbackMap: JSON.parse(raw) });
    } catch {}
  },

  clearFeedback: async () => {
    set({ feedbackMap: {} });
    await AsyncStorage.removeItem(FEEDBACK_KEY);
  },
}));
