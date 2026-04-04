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
  getSimilarItems,
  getBackdropImageUrl,
  getPrimaryImageUrl,
  formatRuntime,
} from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import MediaCard from "@/components/MediaCard";
import EmptyState from "@/components/EmptyState";

const { width } = Dimensions.get("window");
const BACKDROP_H = Math.round(width * 0.58);

export default function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();

  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [similar, setSimilar] = useState<JellyfinItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!serverUrl || !token || !userId || !itemId) return;
    (async () => {
      try {
        const [fetched, sim] = await Promise.all([
          getItem(serverUrl, token, userId, itemId),
          getSimilarItems(serverUrl, token, userId, itemId, 8),
        ]);
        setItem(fetched);
        setSimilar(sim);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 440, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, friction: 14, tension: 100, useNativeDriver: true }),
        ]).start();
      }
    })();
  }, [itemId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingDot} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <EmptyState icon="◌" title="Item not found." />
      </View>
    );
  }

  const backdropUrl =
    serverUrl && item.BackdropImageTags?.[0]
      ? getBackdropImageUrl(serverUrl, item.Id, item.BackdropImageTags[0], width * 2)
      : serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, width * 2)
      : null;

  const actors = (item.People ?? []).filter((p) => p.Type === "Actor").slice(0, 10);
  const directors = (item.People ?? []).filter((p) => p.Type === "Director").slice(0, 3);
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const isSeries = item.Type === "Series";

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/player/${item.Id}`);
  };

  const handleBrowseEpisodes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/series/${item.Id}`);
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      >
        {/* ── Backdrop ─────────────────────────────────────────────── */}
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
            locations={[0.3, 0.65, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Left-edge vignette */}
          <LinearGradient
            colors={["rgba(10,10,12,0.42)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.38, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Warm shimmer on backdrop */}
          <LinearGradient
            colors={["rgba(255,230,140,0.07)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: 70 }]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            pointerEvents="none"
          />

          {/* Back button */}
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

        {/* ── Content ──────────────────────────────────────────────── */}
        <Animated.View style={[styles.content, { transform: [{ translateY: slideAnim }] }]}>
          {/* Title */}
          <Text style={styles.title}>{item.Name}</Text>

          {/* Meta badges */}
          <View style={styles.metaRow}>
            {item.ProductionYear ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.ProductionYear}</Text></View>
            ) : null}
            {item.OfficialRating ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.OfficialRating}</Text></View>
            ) : null}
            {item.RunTimeTicks ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{formatRuntime(item.RunTimeTicks)}</Text></View>
            ) : null}
            {item.CommunityRating ? (
              <View style={[styles.badge, styles.badgeStar]}>
                <Text style={[styles.badgeText, styles.badgeStarText]}>★ {item.CommunityRating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>

          {/* Genres */}
          {item.Genres && item.Genres.length > 0 && (
            <View style={styles.genreRow}>
              {item.Genres.slice(0, 5).map((g) => (
                <View key={g} style={styles.genreTag}>
                  <Text style={styles.genreText}>{g}</Text>
                </View>
              ))}
            </View>
          )}

          {/* In-progress bar */}
          {progress > 1 && progress < 99 && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
              </View>
              <Text style={styles.progressLabel}>{Math.round(100 - progress)}% remaining</Text>
            </View>
          )}

          {/* Overview */}
          {item.Overview ? (
            <Text style={styles.overview}>{item.Overview}</Text>
          ) : null}

          {/* CTA */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.playBtn}
              onPress={isSeries ? handleBrowseEpisodes : handlePlay}
              activeOpacity={0.84}
            >
              <LinearGradient
                colors={["#B8243E", "#8B1A2E"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <LinearGradient
                colors={["rgba(255,230,140,0.13)", "transparent"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              <Text style={styles.playBtnText}>
                {isSeries ? "Browse Episodes  →" : "▶  Play"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Directors */}
          {directors.length > 0 && (
            <View style={styles.creditRow}>
              <Text style={styles.creditLabel}>Director</Text>
              <Text style={styles.creditValue}>{directors.map((d) => d.Name).join(", ")}</Text>
            </View>
          )}

          {/* Cast */}
          {actors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CAST</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.castRow}
              >
                {actors.map((actor) => {
                  const castImageUrl =
                    serverUrl && actor.PrimaryImageTag
                      ? getPrimaryImageUrl(serverUrl, actor.Id, actor.PrimaryImageTag, 120)
                      : null;
                  return (
                    <View key={actor.Id} style={styles.castCard}>
                      <View style={styles.castAvatar}>
                        {castImageUrl ? (
                          <Image
                            source={{ uri: castImageUrl }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                          />
                        ) : (
                          <Text style={styles.castInitial}>{actor.Name?.[0] ?? "?"}</Text>
                        )}
                        <LinearGradient
                          colors={["rgba(255,230,140,0.07)", "transparent"]}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0.2, y: 0 }}
                          end={{ x: 0.8, y: 1 }}
                          pointerEvents="none"
                        />
                      </View>
                      <Text style={styles.castName} numberOfLines={2}>{actor.Name}</Text>
                      {actor.Role && (
                        <Text style={styles.castRole} numberOfLines={1}>{actor.Role}</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* More Like This */}
          {similar.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>MORE LIKE THIS</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarRow}
              >
                {similar.map((s) => (
                  <MediaCard key={s.Id} item={s} size="small" />
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  loadingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textMuted },
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

  content: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.md,
    marginTop: -Spacing.xl,
    paddingBottom: Spacing.xl,
  },

  title: {
    fontFamily: Typography.displayBold,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    lineHeight: 34,
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

  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  genreTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.12)",
  },
  genreText: { fontFamily: Typography.sans, fontSize: 11, color: Colors.textMuted },

  progressWrap: { gap: 5 },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 3, backgroundColor: Colors.brand, borderRadius: 2 },
  progressLabel: { fontFamily: Typography.sans, fontSize: 11, color: Colors.textMuted },

  overview: {
    fontFamily: Typography.sans,
    fontSize: 14.5,
    color: Colors.textSecondary,
    lineHeight: 23,
    letterSpacing: 0.1,
  },

  actions: { marginTop: 4 },
  playBtn: {
    height: 52,
    borderRadius: Radii.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  playBtnText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 16,
    color: "#fff",
    letterSpacing: 0.3,
  },

  creditRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" },
  creditLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textMuted,
    minWidth: 64,
    paddingTop: 1,
  },
  creditValue: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },

  section: { gap: 10 },
  sectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 10.5,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },

  castRow: { gap: Spacing.md, paddingBottom: 4 },
  castCard: { width: 68, gap: 5, alignItems: "center" },
  castAvatar: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  castInitial: { fontFamily: Typography.display, fontSize: 22, color: Colors.textMuted },
  castName: {
    fontFamily: Typography.sansMedium,
    fontSize: 10.5,
    color: Colors.textPrimary,
    textAlign: "center",
    lineHeight: 14,
  },
  castRole: {
    fontFamily: Typography.sans,
    fontSize: 9.5,
    color: Colors.textMuted,
    textAlign: "center",
  },

  similarRow: { gap: Spacing.sm, paddingBottom: 4 },
});
