import { jellyfinFetch } from "./client";
import type { JellyfinAuthResponse, JellyfinUser } from "./types";

export async function authenticateUser(
  serverUrl: string,
  username: string,
  password: string
): Promise<JellyfinAuthResponse> {
  return jellyfinFetch<JellyfinAuthResponse>(serverUrl, "/Users/AuthenticateByName", {
    method: "POST",
    body: { Username: username, Pw: password },
  });
}

export async function getCurrentUser(
  serverUrl: string,
  token: string,
  userId: string
): Promise<JellyfinUser> {
  return jellyfinFetch<JellyfinUser>(serverUrl, `/Users/${userId}`, { token });
}

export async function getUsers(
  serverUrl: string,
  token: string
): Promise<JellyfinUser[]> {
  return jellyfinFetch<JellyfinUser[]>(serverUrl, "/Users", { token });
}
