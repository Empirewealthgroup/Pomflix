import { jellyfinFetch } from "./client";
import type { JellyfinItem, JellyfinItemsResponse, JellyfinPlaybackInfo, JellyfinGenre } from "./types";
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
  limit = 5,
  maxRuntimeOverride: number | null = null
): Promise<JellyfinItem[]> {
  const maxRuntime = maxRuntimeOverride ?? mode.maxRuntimeMinutes ?? null;
  const runtimeTicks = maxRuntime ? maxRuntime * 60 * 10_000_000 : null;
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
        ...(runtimeTicks ? { MaxRunTimeTicks: runtimeTicks } : {}),
      },
    }
  );

  // Fallback stage 2: try mood's fallback genres
  if (!res.Items?.length) {
    const stage2 = await jellyfinFetch<JellyfinItemsResponse>(
      serverUrl,
      `/Users/${userId}/Items`,
      {
        token,
        params: {
          IncludeItemTypes: "Movie,Series",
          Recursive: true,
          SortBy: "Random",
          SortOrder: "Ascending",
          Genres: mode.jellyfinGenresFallback.join("|"),
          Limit: limit,
          Fields: FIELDS,
          IsPlayed: false,
          EnableImageTypes: "Primary,Backdrop",
          ...(runtimeTicks ? { MaxRunTimeTicks: runtimeTicks } : {}),
        },
      }
    );
    if (stage2.Items?.length) return stage2.Items;

    // Fallback stage 3: drop all genre filters
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
          ...(runtimeTicks ? { MaxRunTimeTicks: runtimeTicks } : {}),
        },
      }
    );
    return fallback.Items ?? [];
  }

  return res.Items;
}

// ── Tab-specific content (Movies / Shows / Docs) ─────────────────────────

type ModeTab = "movies" | "shows" | "docs";

export async function getContentForModeTab(
  serverUrl: string,
  token: string,
  userId: string,
  mode: Mode,
  tab: ModeTab,
  limit = 24
): Promise<JellyfinItem[]> {
  const itemType = tab === "shows" ? "Series" : "Movie";

  // Docs: always Documentary genre only
  // Movies/Shows: use mood genres minus Documentary
  const genres =
    tab === "docs"
      ? ["Documentary"]
      : mode.jellyfinGenres.filter((g) => g !== "Documentary");

  const fetchItems = async (genreList: string[]): Promise<JellyfinItem[]> => {
    const res = await jellyfinFetch<JellyfinItemsResponse>(
      serverUrl,
      `/Users/${userId}/Items`,
      {
        token,
        params: {
          IncludeItemTypes: itemType,
          Recursive: true,
          SortBy: "Random",
          SortOrder: "Ascending",
          ...(genreList.length ? { Genres: genreList.join("|") } : {}),
          Limit: limit,
          Fields: FIELDS,
          IsPlayed: false,
          EnableImageTypes: "Primary,Backdrop",
          ...(mode.maxRuntimeMinutes && tab !== "shows"
            ? { MaxRunTimeTicks: mode.maxRuntimeMinutes * 60 * 10_000_000 }
            : {}),
        },
      }
    );
    return res.Items ?? [];
  };

  // Stage 1: primary genres
  let items = await fetchItems(genres);
  if (items.length) return items;

  // Stage 2: fallback genres
  const fallbackGenres =
    tab === "docs" ? [] : mode.jellyfinGenresFallback.filter((g) => g !== "Documentary");
  items = await fetchItems(fallbackGenres);
  if (items.length) return items;

  // Stage 3: no genre filter at all
  return fetchItems([]);
}

// ── Full Library ──────────────────────────────────────────────────────────

export async function getLibraryItems(
  serverUrl: string,
  token: string,
  userId: string,
  options: {
    type?: "Movie" | "Series";
    sortBy?: string;
    sortOrder?: string;
    search?: string;
    genreIds?: string;
    startIndex?: number;
    limit?: number;
  } = {}
): Promise<JellyfinItemsResponse> {
  const { type, sortBy = "SortName", sortOrder = "Ascending", search, genreIds, startIndex = 0, limit = 40 } = options;
  return jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    `/Users/${userId}/Items`,
    {
      token,
      params: {
        IncludeItemTypes: type ?? "Movie,Series",
        Recursive: true,
        SortBy: sortBy,
        SortOrder: sortOrder,
        StartIndex: startIndex,
        Limit: limit,
        Fields: FIELDS,
        EnableImageTypes: "Primary,Backdrop",
        ...(search ? { SearchTerm: search } : {}),
        ...(genreIds ? { GenreIds: genreIds } : {}),
      },
    }
  );
}

// ── Playback ──────────────────────────────────────────────────────────────

// iOS-native formats: MP4/MOV/M4V with H.264 or HEVC, AAC audio
// Anything outside this gets a TranscodingUrl back from Jellyfin
const IOS_DEVICE_PROFILE = {
  DirectPlayProfiles: [
    {
      Type: "Video",
      Container: "mp4,m4v,mov",
      VideoCodec: "h264,hevc,h265",
      AudioCodec: "aac,mp3,ac3,eac3",
    },
  ],
  TranscodingProfiles: [
    {
      Type: "Video",
      Container: "mp4",
      VideoCodec: "h264",
      AudioCodec: "aac",
      Protocol: "http",
      Context: "Streaming",
      MaxAudioChannels: "2",
    },
  ],
  ContainerProfiles: [],
  CodecProfiles: [],
};

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
        DeviceProfile: IOS_DEVICE_PROFILE,
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

export async function getNextEpisode(
  serverUrl: string,
  token: string,
  userId: string,
  seriesId: string,
  currentEpisodeId: string
): Promise<JellyfinItem | null> {
  const res = await jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    `/Shows/${seriesId}/Episodes`,
    {
      token,
      params: {
        UserId: userId,
        Fields: FIELDS,
        EnableImageTypes: "Primary,Backdrop,Thumb",
        AdjacentTo: currentEpisodeId,
        Limit: 1,
      },
    }
  );
  const episodes = res.Items ?? [];
  // AdjacentTo returns the current + next; pick the one that's not current
  const next = episodes.find((e) => e.Id !== currentEpisodeId);
  return next ?? null;
}

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

// ── Recently Added ────────────────────────────────────────────────────────

export async function getRecentlyAdded(
  serverUrl: string,
  token: string,
  userId: string,
  limit = 12
): Promise<JellyfinItem[]> {
  const items = await jellyfinFetch<JellyfinItem[]>(
    serverUrl,
    `/Users/${userId}/Items/Latest`,
    {
      token,
      params: {
        Limit: limit,
        Fields: FIELDS,
        IncludeItemTypes: "Movie,Series",
        EnableImageTypes: "Primary,Backdrop",
      },
    }
  );
  return Array.isArray(items) ? items : [];
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

// ── Genres ────────────────────────────────────────────────────────────────

export async function getGenres(
  serverUrl: string,
  token: string,
  userId: string,
  type?: "Movie" | "Series"
): Promise<JellyfinGenre[]> {
  const res = await jellyfinFetch<{ Items: JellyfinGenre[]; TotalRecordCount: number }>(
    serverUrl,
    `/Genres`,
    {
      token,
      params: {
        UserId: userId,
        SortBy: "SortName",
        SortOrder: "Ascending",
        Recursive: true,
        IncludeItemTypes: type ?? "Movie,Series",
      },
    }
  );
  return res.Items ?? [];
}
