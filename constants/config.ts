// App-wide configuration constants

export const SERVER_URL = "https://jellyfin.pomflix.com";

// Set EXPO_PUBLIC_SIGNUP_API_URL in .env (local) or at build time (production)
export const SIGNUP_API_URL =
  process.env.EXPO_PUBLIC_SIGNUP_API_URL ?? "https://your-server-domain.com";

// Shared secret sent with every signup request — must match SIGNUP_SECRET in server/.env
export const SIGNUP_SECRET =
  process.env.EXPO_PUBLIC_SIGNUP_SECRET ?? "";