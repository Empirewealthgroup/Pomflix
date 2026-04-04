import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
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
const BACKDROP_H = Math.round(width * 0.52);

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

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, friction: 14, tension: 100, useNativeDriver: true }),
        ]).start();
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
        <View style={styles.loadingDot} />
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
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      >
        {/* Backdrop */}
        <View style={[styles.backdropContainer, { height: BACKDROP_H }]}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={320}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.backdropPlaceholder]} />
          )}
          {/* Deep cinematic fade */}
          <LinearGradient
            colors={["transparent", "rgba(10,10,12,0.4)", Colors.bg]}
            locations={[0.25, 0.62, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Left vignette */}
          <LinearGradient
            colors={["rgba(10,10,12,0.38)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.35, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Warm shimmer */}
          <LinearGradient
            colors={["rgba(255,230,140,0.06)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: 60 }]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            pointerEvents="none"
          />

          <SafeAreaView style={styles.backSafe} edges={["top"]}>
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
        <Animated.View style={[styles.header, { transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.seriesTitle}>{series.Name}</Text>
          <View style={styles.metaRow}>
            {series.ProductionYear ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{series.ProductionYear}</Text></View>
            ) : null}
            {series.OfficialRating ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{series.OfficialRating}</Text></View>
            ) : null}
            {series.CommunityRating ? (
              <View style={[styles.badge, styles.badgeStar]}>
                <Text style={[styles.badgeText, styles.badgeStarText]}>★ {series.CommunityRating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
          {series.Overview ? (
            <Text style={styles.seriesOverview} numberOfLines={4}>{series.Overview}</Text>
          ) : null}
        </Animated.View>

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
            <View style={styles.episodesLoading}>
              <View style={styles.loadingDot} />
            </View>
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
                  router.push({ pathname: "/player/[itemId]", params: { itemId: ep.Id, itemName: ep.Name ?? "" } });
                }}
              />
            ))
          )}
        </View>
      </Animated.ScrollView>
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
  const watched = episode.UserData?.Played ?? false;

  return (
    <TouchableOpacity style={styles.epRow} onPress={onPress} activeOpacity={0.8}>
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
        {progress > 0 && progress < 99 && (
          <View style={styles.epProgressTrack}>
            <View style={[styles.epProgressBar, { width: `${progress}%` }]} />
          </View>
        )}
        {/* Play icon overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.5)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.epPlayOverlay} pointerEvents="none">
          <Text style={styles.epPlayIcon}>▶</Text>
        </View>
        {watched && (
          <View style={styles.watchedBadge}>
            <Text style={styles.watchedIcon}>✔</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.epInfo}>
        <View style={styles.epTitleRow}>
          {epNum && <Text style={styles.epNum}>{epNum}</Text>}
          <Text style={styles.epTitle} numberOfLines={2}>
            {episode.Name}
          </Text>
        </View>
        {!!episode.RunTimeTicks && (
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
  loadingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textMuted },
  episodesLoading: { alignItems: "center", paddingTop: Spacing.xl },
  scroll: { paddingBottom: 90 },

  backdropContainer: { width, overflow: "hidden" },
  backdropPlaceholder: { backgroundColor: "#1A1A1E" },
  backSafe: { position: "absolute", top: 0, left: 0, right: 0 },
  backBtn: {
    marginTop: Spacing.xs,
    marginLeft: Spacing.screen,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  header: {
    paddingHorizontal: Spacing.screen,
    gap: 8,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.md,
  },
  seriesTitle: {
    fontFamily: Typography.displayBold,
    fontSize: 26,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  badgeStar: { backgroundColor: "rgba(180,60,30,0.18)", borderColor: "rgba(180,60,30,0.3)" },
  badgeText: { fontFamily: Typography.sans, fontSize: 12, color: Colors.textSecondary },
  badgeStarText: { color: "#E0905A" },
  seriesOverview: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    letterSpacing: 0.1,
    marginTop: 4,
  },

  seasonScroll: { marginBottom: Spacing.md },
  seasonTabs: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.xs,
  },
  seasonTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.12)",
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
  seasonTabTextActive: { color: "#fff" },

  episodesList: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },

  epRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  epThumb: {
    width: 128,
    height: 72,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
    flexShrink: 0,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.07)",
  },
  epThumbPlaceholder: { backgroundColor: Colors.surfaceRaised },
  epProgressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  epProgressBar: { height: 3, backgroundColor: Colors.brand, borderRadius: 1 },
  epPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  epPlayIcon: { fontSize: 14, color: "rgba(255,255,255,0.75)" },
  watchedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(139,26,46,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  watchedIcon: { fontSize: 8, color: "#fff" },
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
