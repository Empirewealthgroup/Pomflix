// Jellyfin REST API — TypeScript types

export interface JellyfinAuthResponse {
  AccessToken: string;
  ServerId: string;
  SessionInfo: {
    UserId: string;
    UserName: string;
  };
  User: JellyfinUser;
}

export interface JellyfinUser {
  Id: string;
  Name: string;
  PrimaryImageTag?: string;
  Policy: {
    IsAdministrator: boolean;
  };
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  OriginalTitle?: string;
  Type: "Movie" | "Series" | "Episode" | "Season";
  Overview?: string;
  Genres?: string[];
  Tags?: string[];
  CommunityRating?: number;
  ProductionYear?: number;
  RunTimeTicks?: number; // in 100-nanosecond intervals
  ImageTags?: {
    Primary?: string;
    Backdrop?: string;
    Thumb?: string;
    Logo?: string;
  };
  BackdropImageTags?: string[];
  UserData?: {
    PlayedPercentage?: number;
    PlaybackPositionTicks?: number;
    Played: boolean;
    IsFavorite: boolean;
  };
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  SeasonName?: string;
  ParentIndexNumber?: number; // season number
  IndexNumber?: number; // episode number
  People?: JellyfinPerson[];
  Studios?: { Name: string; Id: string }[];
  OfficialRating?: string;
}

export interface JellyfinPerson {
  Id: string;
  Name: string;
  Role?: string;
  Type: "Actor" | "Director" | "Writer" | "Producer" | "GuestStar" | string;
  PrimaryImageTag?: string;
}

export interface JellyfinItemsResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
  StartIndex: number;
}

export interface JellyfinPlaybackInfo {
  MediaSources: JellyfinMediaSource[];
  PlaySessionId: string;
}

export interface JellyfinMediaSource {
  Id: string;
  Name: string;
  Path: string;
  DirectStreamUrl?: string;
  SupportsDirectStream: boolean;
  SupportsDirectPlay: boolean;
  Container: string;
  Bitrate?: number;
}
