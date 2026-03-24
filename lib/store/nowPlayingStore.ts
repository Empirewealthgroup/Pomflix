import { create } from "zustand";

export type NowPlayingItem = {
  itemId: string;
  itemName: string;
  modeColor: string;
  progress: number; // 0–100
};

type NowPlayingState = {
  nowPlaying: NowPlayingItem | null;
  setNowPlaying: (item: NowPlayingItem) => void;
  updateNowPlayingProgress: (progress: number) => void;
  clearNowPlaying: () => void;
};

export const useNowPlayingStore = create<NowPlayingState>()((set) => ({
  nowPlaying: null,

  setNowPlaying: (item) => set({ nowPlaying: item }),

  updateNowPlayingProgress: (progress) =>
    set((state) =>
      state.nowPlaying ? { nowPlaying: { ...state.nowPlaying, progress } } : state
    ),

  clearNowPlaying: () => set({ nowPlaying: null }),
}));
