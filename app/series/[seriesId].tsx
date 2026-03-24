import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native";
import { useAuthStore } from "@/lib/store/authStore";
import {
  getItem,
  getSeasons,
  getEpisodes,
  getBackdropImageUrl,
  getPrimaryImageUrl,
  formatRuntime,
} from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import EmptyState from "@/components/EmptyState";

const { width } = Dimensions.get("window");
const BACKDROP_HEIGHT = width * 0.5;

export default function SeriesScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();

  const [series, setSeries] = useState<JellyfinItem | null>(null);
  const [seasons, setSeasons] = useState<JellyfinItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<JellyfinItem | null>(null);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Load series info + seasons
  useEffect(() => {
    if (!serverUrl || !token || !userId || !seriesId) return;
    (async () => {
      try {
        const [s, seasonsRes] = await Promise.all([
          getItem(serverUrl, token, userId, seriesId),
          getSeasons(serverUrl, token, userId, seriesId),
        ]);
        setSeries(s);
        const seasonsData = seasonsRes.Items ?? [];
        setSeasons(seasonsData);
        if (seasonsData.length > 0) setSelectedSeason(seasonsData[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [seriesId]);

  // Load episodes when season changes
  useEffect(() => {
    if (!serverUrl || !token || !userId || !seriesId || !selectedSeason) return;
    setLoadingEpisodes(true);
    setEpisodes([]);
    getEpisodes(serverUrl, token, userId, seriesId, selectedSeason.Id)
      .then((res) => setEpisodes(res.Items ?? []))
      .catch(() => {})
      .finally(() => setLoadingEpisodes(false));
  }, [selectedSeason?.Id]);

  const backdropUrl =
    serverUrl && series
      ? series.BackdropImageTags?.[0]
        ? getBackdropImageUrl(serverUrl, series.Id, series.BackdropImageTags[0], width * 2)
        : series.ImageTags?.Primary
        ? getPrimaryImageUrl(serverUrl, series.Id, series.ImageTags.Primary, width * 2)
        : null
      : null;

  if (loadingMeta) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.textSecondary} />
      </View>
    );
  }

  if (!series) {
    return (
      <View style={styles.center}>
        <EmptyState icon="◌" title="Series not found." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Backdrop */}
        <View style={[styles.backdropContainer, { height: BACKDROP_HEIGHT }]}>
          {backdropUrl && (
            <Image
              source={{ uri: backdropUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
            />
          )}
          <LinearGradient
            colors={["transparent", Colors.bg]}
            start={{ x: 0, y: 0.35 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <SafeAreaView style={styles.backSafe}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={12}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.seriesTitle}>{series.Name}</Text>
          {series.ProductionYear && (
            <Text style={styles.seriesYear}>{series.ProductionYear}</Text>
          )}
        </View>

        {/* Season selector */}
        {seasons.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seasonTabs}
            style={styles.seasonScroll}
          >
            {seasons.map((s) => {
              const active = s.Id === selectedSeason?.Id;
              return (
                <TouchableOpacity
                  key={s.Id}
                  style={[styles.seasonTab, active && styles.seasonTabActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedSeason(s);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.seasonTabText, active && styles.seasonTabTextActive]}>
                    {s.Name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Episodes */}
        <View style={styles.episodesList}>
          {loadingEpisodes ? (
            <ActivityIndicator color={Colors.textSecondary} style={{ marginTop: Spacing.xl }} />
          ) : episodes.length === 0 ? (
            <EmptyState icon="◌" title="No episodes found." />
          ) : (
            episodes.map((ep) => (
              <EpisodeRow
                key={ep.Id}
                episode={ep}
                serverUrl={serverUrl ?? ""}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push(`/player/${ep.Id}`);
                }}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function EpisodeRow({
  episode,
  serverUrl,
  onPress,
}: {
  episode: JellyfinItem;
  serverUrl: string;
  onPress: () => void;
}) {
  const thumbUrl =
    episode.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, episode.Id, episode.ImageTags.Primary, 320)
      : episode.BackdropImageTags?.[0]
      ? getBackdropImageUrl(serverUrl, episode.Id, episode.BackdropImageTags[0], 320)
      : null;

  const epNum =
    episode.IndexNumber != null
      ? `E${episode.IndexNumber}`
      : null;
  const progress = episode.UserData?.PlayedPercentage ?? 0;

  return (
    <TouchableOpacity style={styles.epRow} onPress={onPress} activeOpacity={0.82}>
      {/* Thumbnail */}
      <View style={styles.epThumb}>
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.epThumbPlaceholder]} />
        )}
        {/* Progress bar on thumb */}
        {progress > 0 && progress < 100 && (
          <View style={styles.epProgressTrack}>
            <View style={[styles.epProgressBar, { width: `${progress}%` }]} />
          </View>
        )}
        {/* Play icon overlay */}
        <View style={styles.epPlayOverlay} pointerEvents="none">
          <Text style={styles.epPlayIcon}>▶</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.epInfo}>
        <View style={styles.epTitleRow}>
          {epNum && <Text style={styles.epNum}>{epNum}</Text>}
          <Text style={styles.epTitle} numberOfLines={2}>
            {episode.Name}
          </Text>
        </View>
        {episode.RunTimeTicks && (
          <Text style={styles.epMeta}>{formatRuntime(episode.RunTimeTicks)}</Text>
        )}
        {episode.Overview && (
          <Text style={styles.epOverview} numberOfLines={2}>
            {episode.Overview}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: Spacing.xxl },

  backdropContainer: { width, overflow: "hidden" },
  backSafe: { position: "absolute", top: 0, left: 0, right: 0 },
  backBtn: {
    marginTop: Spacing.sm,
    marginLeft: Spacing.screen,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.full,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  header: {
    paddingHorizontal: Spacing.screen,
    gap: 4,
    marginTop: -Spacing.md,
    marginBottom: Spacing.md,
  },
  seriesTitle: {
    fontFamily: Typography.displayBold,
    fontSize: 24,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  seriesYear: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  seasonScroll: { marginBottom: Spacing.md },
  seasonTabs: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.xs,
  },
  seasonTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  seasonTabActive: {
    backgroundColor: Colors.brand,
    borderColor: Colors.brand,
  },
  seasonTabText: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  seasonTabTextActive: {
    color: Colors.textPrimary,
  },

  episodesList: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.md,
  },

  epRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  epThumb: {
    width: 120,
    height: 68,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
    flexShrink: 0,
  },
  epThumbPlaceholder: {
    backgroundColor: Colors.surfaceRaised,
  },
  epProgressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  epProgressBar: {
    height: 3,
    backgroundColor: Colors.brand,
    borderRadius: 1,
  },
  epPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  epPlayIcon: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
  },
  epInfo: {
    flex: 1,
    gap: 3,
  },
  epTitleRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    alignItems: "flex-start",
  },
  epNum: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.brand,
    minWidth: 24,
    marginTop: 1,
  },
  epTitle: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  epMeta: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.textMuted,
  },
  epOverview: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
