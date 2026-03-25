// Jellyfin Base HTTP Client
import { router } from "expo-router";
import { useAuthStore } from "@/lib/store/authStore";

const CLIENT_NAME = "Pomflix";
const CLIENT_VERSION = "1.0.0";
const DEVICE_NAME = "Pomflix App";
const DEVICE_ID = "pomflix-app-v1";

export function buildAuthHeader(token?: string): string {
  const parts = [
    `Client="${CLIENT_NAME}"`,
    `Device="${DEVICE_NAME}"`,
    `DeviceId="${DEVICE_ID}"`,
    `Version="${CLIENT_VERSION}"`,
  ];
  if (token) parts.push(`Token="${token}"`);
  return `MediaBrowser ${parts.join(", ")}`;
}

export async function jellyfinFetch<T>(
  serverUrl: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    token?: string;
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
  } = {}
): Promise<T> {
  const { method = "GET", token, body, params } = options;

  // Build query string
  let url = `${serverUrl.replace(/\/$/, "")}${path}`;
  if (params) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (query) url += `?${query}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Authorization": buildAuthHeader(token),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401) {
    // Session expired or revoked — clear credentials and redirect to login
    useAuthStore.getState().logout().then(() => {
      router.replace("/(auth)/login");
    });
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Jellyfin ${method} ${path} → ${response.status}: ${text}`);
  }

  // Some endpoints return empty body
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}
