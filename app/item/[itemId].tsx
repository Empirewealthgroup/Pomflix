import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
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
const BACKDROP_HEIGHT = width * 0.56;

export default function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();

  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [similar, setSimilar] = useState<JellyfinItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      }
    })();
  }, [itemId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.textSecondary} />
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

  const actors = (item.People ?? []).filter((p) => p.Type === "Actor").slice(0, 8);
  const directors = (item.People ?? []).filter((p) => p.Type === "Director").slice(0, 2);
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
            start={{ x: 0, y: 0.4 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Back button */}
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

        {/* Content */}
        <View style={styles.content}>
          {/* Title + meta */}
          <Text style={styles.title}>{item.Name}</Text>

          <View style={styles.metaRow}>
            {item.ProductionYear && (
              <Text style={styles.metaBadge}>{item.ProductionYear}</Text>
            )}
            {item.OfficialRating && (
              <Text style={styles.metaBadge}>{item.OfficialRating}</Text>
            )}
            {item.RunTimeTicks && (
              <Text style={styles.metaBadge}>{formatRuntime(item.RunTimeTicks)}</Text>
            )}
            {item.CommunityRating && (
              <Text style={styles.metaBadge}>★ {item.CommunityRating.toFixed(1)}</Text>
            )}
          </View>

          {item.Genres && item.Genres.length > 0 && (
            <View style={styles.genresRow}>
              {item.Genres.slice(0, 4).map((g) => (
                <View key={g} style={styles.genreTag}>
                  <Text style={styles.genreText}>{g}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Overview */}
          {item.Overview ? (
            <Text style={styles.overview}>{item.Overview}</Text>
          ) : null}

          {/* CTA Buttons */}
          <View style={styles.actions}>
            {!isSeries ? (
              <TouchableOpacity style={styles.playBtn} onPress={handlePlay} activeOpacity={0.85}>
                <Text style={styles.playBtnText}>▶  Play</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.playBtn}
                onPress={handleBrowseEpisodes}
                activeOpacity={0.85}
              >
                <Text style={styles.playBtnText}>Episodes →</Text>
              </TouchableOpacity>
            )}
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
              <Text style={styles.sectionTitle}>Cast</Text>
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
                          <Text style={styles.castInitial}>{actor.Name[0]}</Text>
                        )}
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

          {/* Similar */}
          {similar.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>More Like This</Text>
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
        </View>
      </ScrollView>
    </View>
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

  content: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.md,
    marginTop: -Spacing.lg,
  },

  title: {
    fontFamily: Typography.displayBold,
    fontSize: 26,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 32,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  metaBadge: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
  },

  genresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  genreTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  genreText: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.textMuted,
  },

  overview: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  playBtn: {
    flex: 1,
    backgroundColor: Colors.brand,
    paddingVertical: Spacing.md - 2,
    borderRadius: Radii.md,
    alignItems: "center",
  },
  playBtnText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },

  creditRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  creditLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textSecondary,
    minWidth: 60,
  },
  creditValue: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textPrimary,
    flex: 1,
  },

  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },

  castRow: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  castCard: { width: 72, gap: 4 },
  castAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  castInitial: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.textMuted,
  },
  castName: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  castRole: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },

  similarRow: { gap: Spacing.sm, paddingBottom: Spacing.xs },
});
