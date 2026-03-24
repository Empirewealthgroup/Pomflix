import { jellyfinFetch } from "./client";
import type { JellyfinItem, JellyfinItemsResponse, JellyfinPlaybackInfo } from "./types";
import type { Mode } from "@/constants/modes";

const FIELDS = "Overview,Genres,Tags,CommunityRating,ProductionYear,RunTimeTicks,ImageTags,BackdropImageTags,UserData";

// ── Image URLs ─────────────────────────────────────────────────────────────

export function getPrimaryImageUrl(
  serverUrl: string,
  itemId: string,
  imageTag: string,
  width = 400
): string {
  return `${serverUrl}/Items/${itemId}/Images/Primary?fillWidth=${width}&quality=90&tag=${imageTag}`;
}

export function getBackdropImageUrl(
  serverUrl: string,
  itemId: string,
  backdropTag: string,
  width = 1280
): string {
  return `${serverUrl}/Items/${itemId}/Images/Backdrop/0?fillWidth=${width}&quality=90&tag=${backdropTag}`;
}

// ── Resume / Continue Watching ─────────────────────────────────────────────

export async function getContinueWatching(
  serverUrl: string,
  token: string,
  userId: string,
  limit = 10
): Promise<JellyfinItem[]> {
  const res = await jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    `/Users/${userId}/Items/Resume`,
    {
      token,
      params: {
        Limit: limit,
        Fields: FIELDS,
        MediaTypes: "Video",
        EnableImageTypes: "Primary,Backdrop,Thumb",
      },
    }
  );
  return res.Items ?? [];
}

// ── Mode-Based Suggestions (3-5 items) ────────────────────────────────────

export async function getSuggestionsForMode(
  serverUrl: string,
  token: string,
  userId: string,
  mode: Mode,
  limit = 5
): Promise<JellyfinItem[]> {
  const res = await jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    `/Users/${userId}/Items`,
    {
      token,
      params: {
        IncludeItemTypes: "Movie,Series",
        Recursive: true,
        SortBy: "Random",
        SortOrder: "Ascending",
        Genres: mode.jellyfinGenres.join("|"),
        Limit: limit,
        Fields: FIELDS,
        IsPlayed: false,
        EnableImageTypes: "Primary,Backdrop",
        ...(mode.maxRuntimeMinutes
          ? { MaxOfficialRating: "PG-13", MaxRunTimeTicks: mode.maxRuntimeMinutes * 60 * 10_000_000 }
          : {}),
      },
    }
  );

  // Fallback: if genre filter returns nothing, drop the genre filter
  if (!res.Items?.length) {
    const fallback = await jellyfinFetch<JellyfinItemsResponse>(
      serverUrl,
      `/Users/${userId}/Items`,
      {
        token,
        params: {
          IncludeItemTypes: "Movie,Series",
          Recursive: true,
          SortBy: "Random",
          Limit: limit,
          Fields: FIELDS,
          EnableImageTypes: "Primary,Backdrop",
        },
      }
    );
    return fallback.Items ?? [];
  }

  return res.Items;
}

// ── Full Library ──────────────────────────────────────────────────────────

export async function getLibraryItems(
  serverUrl: string,
  token: string,
  userId: string,
  options: {
    type?: "Movie" | "Series";
    sortBy?: string;
    search?: string;
    startIndex?: number;
    limit?: number;
  } = {}
): Promise<JellyfinItemsResponse> {
  const { type, sortBy = "SortName", search, startIndex = 0, limit = 40 } = options;
  return jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    `/Users/${userId}/Items`,
    {
      token,
      params: {
        IncludeItemTypes: type ?? "Movie,Series",
        Recursive: true,
        SortBy: sortBy,
        SortOrder: "Ascending",
        StartIndex: startIndex,
        Limit: limit,
        Fields: FIELDS,
        EnableImageTypes: "Primary,Backdrop",
        ...(search ? { SearchTerm: search } : {}),
      },
    }
  );
}

// ── Playback ──────────────────────────────────────────────────────────────

export async function getPlaybackInfo(
  serverUrl: string,
  token: string,
  userId: string,
  itemId: string
): Promise<JellyfinPlaybackInfo> {
  return jellyfinFetch<JellyfinPlaybackInfo>(
    serverUrl,
    `/Items/${itemId}/PlaybackInfo`,
    {
      method: "POST",
      token,
      body: {
        UserId: userId,
        DeviceProfile: {
          DirectPlayProfiles: [{ Type: "Video" }],
        },
      },
    }
  );
}

export function getStreamUrl(
  serverUrl: string,
  itemId: string,
  token: string,
  mediaSourceId: string
): string {
  return (
    `${serverUrl}/Videos/${itemId}/stream` +
    `?MediaSourceId=${mediaSourceId}` +
    `&Static=true` +
    `&Token=${token}`
  );
}

// ── Playback Progress Reporting ──────────────────────────────────────────

export async function reportPlaybackStart(
  serverUrl: string,
  token: string,
  itemId: string,
  mediaSourceId: string,
  playSessionId: string
): Promise<void> {
  await jellyfinFetch<void>(serverUrl, "/Sessions/Playing", {
    method: "POST",
    token,
    body: {
      ItemId: itemId,
      MediaSourceId: mediaSourceId,
      PlaySessionId: playSessionId,
      CanSeek: true,
      IsPaused: false,
      IsMuted: false,
    },
  }).catch(() => {});
}

export async function reportPlaybackProgress(
  serverUrl: string,
  token: string,
  itemId: string,
  mediaSourceId: string,
  playSessionId: string,
  positionTicks: number,
  isPaused = false
): Promise<void> {
  await jellyfinFetch<void>(serverUrl, "/Sessions/Playing/Progress", {
    method: "POST",
    token,
    body: {
      ItemId: itemId,
      MediaSourceId: mediaSourceId,
      PlaySessionId: playSessionId,
      PositionTicks: Math.round(positionTicks),
      IsPaused: isPaused,
      IsMuted: false,
      CanSeek: true,
    },
  }).catch(() => {});
}

export async function reportPlaybackStopped(
  serverUrl: string,
  token: string,
  itemId: string,
  mediaSourceId: string,
  playSessionId: string,
  positionTicks: number
): Promise<void> {
  await jellyfinFetch<void>(serverUrl, "/Sessions/Playing/Stopped", {
    method: "POST",
    token,
    body: {
      ItemId: itemId,
      MediaSourceId: mediaSourceId,
      PlaySessionId: playSessionId,
      PositionTicks: Math.round(positionTicks),
    },
  }).catch(() => {});
}

// ── Series: Seasons + Episodes ────────────────────────────────────────────

export async function getSeasons(
  serverUrl: string,
  token: string,
  userId: string,
  seriesId: string
): Promise<JellyfinItemsResponse> {
  return jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    `/Shows/${seriesId}/Seasons`,
    {
      token,
      params: {
        UserId: userId,
        Fields: FIELDS,
        EnableImageTypes: "Primary,Backdrop,Thumb",
      },
    }
  );
}

export async function getEpisodes(
  serverUrl: string,
  token: string,
  userId: string,
  seriesId: string,
  seasonId: string
): Promise<JellyfinItemsResponse> {
  return jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    `/Shows/${seriesId}/Episodes`,
    {
      token,
      params: {
        UserId: userId,
        SeasonId: seasonId,
        Fields: FIELDS,
        EnableImageTypes: "Primary,Backdrop,Thumb",
      },
    }
  );
}

// ── Item Detail (single item + similar) ──────────────────────────────────

export async function getItem(
  serverUrl: string,
  token: string,
  userId: string,
  itemId: string
): Promise<JellyfinItem> {
  return jellyfinFetch<JellyfinItem>(
    serverUrl,
    `/Users/${userId}/Items/${itemId}`,
    {
      token,
      params: {
        Fields: `${FIELDS},People`,
      },
    }
  );
}

export async function getSimilarItems(
  serverUrl: string,
  token: string,
  userId: string,
  itemId: string,
  limit = 8
): Promise<JellyfinItem[]> {
  const res = await jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    `/Items/${itemId}/Similar`,
    {
      token,
      params: {
        UserId: userId,
        Limit: limit,
        Fields: FIELDS,
        EnableImageTypes: "Primary,Backdrop",
      },
    }
  );
  return res.Items ?? [];
}

// ── Runtime helpers ───────────────────────────────────────────────────────

export function ticksToMinutes(ticks: number): number {
  return Math.round(ticks / 10_000_000 / 60);
}

export function formatRuntime(ticks: number): string {
  const mins = ticksToMinutes(ticks);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
