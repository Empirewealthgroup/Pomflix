import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const KEYS = {
  token: "pom_token",
  userId: "pom_userId",
  serverUrl: "pom_serverUrl",
  userName: "pom_userName",
};

type AuthState = {
  token: string | null;
  userId: string | null;
  userName: string | null;
  serverUrl: string | null;
  isLoading: boolean;
  isNewLogin: boolean;

  setAuth: (data: {
    token: string;
    userId: string;
    userName: string;
    serverUrl: string;
  }) => Promise<void>;

  clearNewLogin: () => void;
  loadStoredAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  userName: null,
  serverUrl: null,
  isLoading: true,
  isNewLogin: false,

  setAuth: async ({ token, userId, userName, serverUrl }) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.token, token),
      SecureStore.setItemAsync(KEYS.userId, userId),
      SecureStore.setItemAsync(KEYS.serverUrl, serverUrl),
      SecureStore.setItemAsync(KEYS.userName, userName),
    ]);
    set({ token, userId, userName, serverUrl, isLoading: false, isNewLogin: true });
  },

  clearNewLogin: () => set({ isNewLogin: false }),

  loadStoredAuth: async () => {
    try {
      const [token, userId, serverUrl, userName] = await Promise.all([
        SecureStore.getItemAsync(KEYS.token),
        SecureStore.getItemAsync(KEYS.userId),
        SecureStore.getItemAsync(KEYS.serverUrl),
        SecureStore.getItemAsync(KEYS.userName),
      ]);
      if (token && userId && serverUrl) {
        set({ token, userId, serverUrl, userName, isLoading: false });
        return true;
      }
    } catch {}
    set({ isLoading: false });
    return false;
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.token),
      SecureStore.deleteItemAsync(KEYS.userId),
      SecureStore.deleteItemAsync(KEYS.serverUrl),
      SecureStore.deleteItemAsync(KEYS.userName),
    ]);
    set({ token: null, userId: null, userName: null, serverUrl: null });
  },
}));
