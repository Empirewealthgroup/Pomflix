import { create } from "zustand";

export type FeedbackRating = "perfect" | "okay" | "skip";

type FeedbackState = {
  feedbackMap: Record<string, FeedbackRating>;
  setFeedback: (itemId: string, rating: FeedbackRating) => void;
  getFeedback: (itemId: string) => FeedbackRating | undefined;
  isSkipped: (itemId: string) => boolean;
};

export const useFeedbackStore = create<FeedbackState>()((set, get) => ({
  feedbackMap: {},

  setFeedback: (itemId, rating) =>
    set((state) => ({
      feedbackMap: { ...state.feedbackMap, [itemId]: rating },
    })),

  getFeedback: (itemId) => get().feedbackMap[itemId],

  isSkipped: (itemId) => get().feedbackMap[itemId] === "skip",
}));
