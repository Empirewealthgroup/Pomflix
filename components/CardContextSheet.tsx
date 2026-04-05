import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  TouchableOpacity,
  PanResponder,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Image } from "expo-image";
import { useRef, useEffect, useState, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/store/authStore";
import {
  setFavorite,
  getBackdropImageUrl,
  getPrimaryImageUrl,
  formatRuntime,
} from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography } from "@/constants/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CardContextSheetProps {
  item: JellyfinItem | null;
  onClose: () => void;
  /** Called after favorite is toggled so parent can refresh isFavorite state */
  onFavoriteChange?: (itemId: string, isFavorite: boolean) => void;
}

// ─── Animated action button ───────────────────────────────────────────────────
function ActionBtn({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: any;
  children: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.93, friction: 5, tension: 380, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start();
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

export default function CardContextSheet({
  item,
  onClose,
  onFavoriteChange,
}: CardContextSheetProps) {
  const { serverUrl, token, userId } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetScale = useRef(new Animated.Value(0.96)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Local optimistic favorite state — seeded from item prop
  const [isFavorite, setIsFavorite] = useState(item?.UserData?.IsFavorite ?? false);
  const togglingRef = useRef(false);

  // Sync when item changes
  useEffect(() => {
    setIsFavorite(item?.UserData?.IsFavorite ?? false);
    setExpanded(false);
    panY.setValue(0);
  }, [item?.Id]);

  const visible = !!item;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      panY.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 15,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(sheetScale, {
          toValue: 1,
          friction: 15,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: true }),
        Animated.timing(sheetScale, { toValue: 0.96, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted || !item) return null;

  // Pan responder: swipe down to close, swipe up to expand
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) {
        panY.setValue(gs.dy);
      } else {
        // Resist upward drag (rubberbanding)
        panY.setValue(gs.dy * 0.25);
      }
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.6) {
        // Swipe down → close
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }),
          Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(panY, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => { panY.setValue(0); onClose(); });
      } else if (gs.dy < -40 && !expanded) {
        // Swipe up → expand
        Animated.spring(panY, { toValue: 0, friction: 12, tension: 200, useNativeDriver: true }).start();
        LayoutAnimation.configureNext({
          duration: 260,
          create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
          update: { type: LayoutAnimation.Types.easeInEaseOut },
        });
        setExpanded(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        // Snap back
        Animated.spring(panY, { toValue: 0, friction: 10, tension: 220, useNativeDriver: true }).start();
      }
    },
  });

  const backdropUrl =
    serverUrl && (item.BackdropImageTags?.length ?? 0) > 0
      ? getBackdropImageUrl(serverUrl, item.Id, item.BackdropImageTags![0], 800)
      : serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, 800)
      : null;

  const year    = item.ProductionYear ?? null;
  const runtime = item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null;
  const rating  = item.CommunityRating ? item.CommunityRating.toFixed(1) : null;

  // Hero image moves slightly with drag gesture (parallax)
  const heroParallax = panY.interpolate({
    inputRange: [-100, 0, 300],
    outputRange: [-14, 0, 20],
    extrapolate: "clamp",
  });

  const isEpisode = item.Type === "Episode";
  const favoriteTargetId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;

  const typeBadge =
    item.Type === "Series" ? "SERIES" :
    item.Type === "Episode" ? (
      item.ParentIndexNumber != null && item.IndexNumber != null
        ? `S${item.ParentIndexNumber}  E${item.IndexNumber}`
        : "EPISODE"
    ) : "FILM";

  const handleToggleFavorite = async () => {
    if (togglingRef.current || !serverUrl || !token || !userId) return;
    togglingRef.current = true;
    const next = !isFavorite;
    setIsFavorite(next); // optimistic
    Haptics.impactAsync(
      next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    try {
      await setFavorite(serverUrl, token, userId, favoriteTargetId, next);
      onFavoriteChange?.(item.Id, next);
    } catch {
      setIsFavorite(!next); // revert
    } finally {
      togglingRef.current = false;
    }
  };

  const handlePlay = () => {
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.Type === "Series") {
      router.push({ pathname: "/series/[seriesId]", params: { seriesId: item.Id } });
    } else if (item.Type === "Episode") {
      router.push({ pathname: "/player/[itemId]", params: { itemId: item.Id, itemName: item.Name ?? "" } });
    } else {
      router.push({ pathname: "/player/[itemId]", params: { itemId: item.Id, itemName: item.Name ?? "" } });
    }
  };

  const handleDetails = () => {
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.Type === "Episode" && item.SeriesId) {
      router.push({ pathname: "/series/[seriesId]", params: { seriesId: item.SeriesId } });
    } else {
      router.push(`/item/${item.Id}` as never);
    }
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          {
            transform: [
              { translateY: Animated.add(slideAnim, panY) },
              { scale: sheetScale },
            ],
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Drag handle — the panResponder lives here */}
        <View style={s.handleArea} {...panResponder.panHandlers}>
          <View style={s.handle} />
          {!expanded && (
            <Text style={s.expandHint}>↑ swipe up for more</Text>
          )}
        </View>

        {/* Hero card — poster/backdrop with parallax + dual-scrim gradient */}
        <View style={s.hero}>
          {/* Poster image — translates with drag for parallax feel */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateY: heroParallax }] }]}
          >
            {backdropUrl ? (
              <Image
                source={{ uri: backdropUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={280}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, s.heroPlaceholder]} />
            )}
          </Animated.View>
          {/* Top scrim — keeps badge readable */}
          <LinearGradient
            colors={["rgba(0,0,0,0.52)", "transparent"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: "44%" }}
            pointerEvents="none"
          />
          {/* Bottom scrim — fades into sheet bg for title legibility */}
          <LinearGradient
            colors={["transparent", "rgba(10,8,12,0.88)", "#0F0F14"]}
            locations={[0.28, 0.76, 1]}
            style={s.heroBottomGrad}
            pointerEvents="none"
          />
          {/* Type badge */}
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>{typeBadge}</Text>
          </View>
          {/* Title + series name + metadata row */}
          <View style={s.heroMeta}>
            <Text style={s.heroTitle} numberOfLines={2}>{item.Name}</Text>
            {isEpisode && item.SeriesName ? (
              <Text style={s.heroSeriesName} numberOfLines={1}>{item.SeriesName}</Text>
            ) : null}
            <View style={s.metaRow}>
              {year ? <Text style={s.metaChip}>{year}</Text> : null}
              {runtime ? <><Text style={s.metaDot}>·</Text><Text style={s.metaChip}>{runtime}</Text></> : null}
              {rating ? (
                <><Text style={s.metaDot}>·</Text><View style={s.ratingChip}><Text style={s.ratingStar}>★</Text><Text style={s.ratingValue}>{rating}</Text></View></>
              ) : null}
            </View>
          </View>
        </View>

        {/* Overview */}
        {!!item.Overview && (
          <Text style={s.overview} numberOfLines={expanded ? undefined : 3}>
            {item.Overview}
          </Text>
        )}

        {/* Genres */}
        {(item.Genres?.length ?? 0) > 0 && (
          <View style={s.genreRow}>
            {item.Genres!.slice(0, 4).map((g) => (
              <View key={g} style={s.genrePill}>
                <Text style={s.genrePillText}>{g}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions — Save (secondary) | Play (dominant) | Details (secondary) */}
        <View style={s.actions}>
          {/* Save */}
          <ActionBtn
            onPress={handleToggleFavorite}
            style={[s.actionSecondary, isFavorite && s.actionSecondaryActive]}
          >
            <Text style={[s.secIcon, isFavorite && s.secIconActive]}>
              {isFavorite ? "♥" : "♡"}
            </Text>
            <Text style={[s.secLabel, isFavorite && s.secLabelActive]}>
              {isFavorite ? "Saved" : isEpisode ? "Save Show" : "Save"}
            </Text>
          </ActionBtn>

          {/* Play — dominant with gradient fill + glow shadow */}
          <ActionBtn onPress={handlePlay} style={s.actionPlay}>
            <LinearGradient
              colors={["#AD1A2E", "#900020"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={s.playGradient}
            >
              <Text style={s.playIcon}>▶</Text>
              <Text style={s.playLabel}>
                {item.Type === "Series" ? "Episodes" : "Play"}
              </Text>
            </LinearGradient>
          </ActionBtn>

          {/* Details */}
          <ActionBtn onPress={handleDetails} style={s.actionSecondary}>
            <Text style={s.secIcon}>ⓘ</Text>
            <Text style={s.secLabel}>{isEpisode ? "Series" : "Details"}</Text>
          </ActionBtn>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const SHEET_BG  = "#0F0F14";
const BORDER    = "rgba(255,255,255,0.06)";
const TEXT      = "#F2EDE8";
const TEXT2     = "rgba(255,255,255,0.44)";
const TEXT3     = "rgba(255,255,255,0.22)";
const RED_DEEP  = "#900020";
const RED_MID   = "#AD1A2E";
const RED_LIGHT = "#C8283D";

const s = StyleSheet.create({
  // ── Backdrop ─────────────────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.74)",
    zIndex: 10,
  },

  // ── Sheet ────────────────────────────────────────────────────────────────
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 0,
    zIndex: 11,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 24,
  },

  // ── Handle ───────────────────────────────────────────────────────────────
  handleArea: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 6,
    gap: 4,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  expandHint: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: TEXT3,
    letterSpacing: 0.4,
    marginTop: 2,
  },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    height: 194,
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroPlaceholder: {
    backgroundColor: "#1A1A22",
  },
  heroBottomGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "74%",
  },
  heroBadge: {
    position: "absolute",
    top: 11,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.46)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroBadgeText: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 1.6,
  },
  heroMeta: {
    position: "absolute",
    bottom: 13,
    left: 14,
    right: 14,
    gap: 4,
  },
  heroTitle: {
    fontFamily: Typography.displayBold,
    fontSize: 22,
    color: TEXT,
    letterSpacing: -0.7,
    lineHeight: 27,
  },
  heroSeriesName: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: TEXT2,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  metaChip: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: TEXT2,
    letterSpacing: 0.5,
  },
  metaDot: {
    fontSize: 9,
    color: TEXT3,
    lineHeight: 14,
  },
  ratingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingStar: {
    fontSize: 9,
    color: "#C8A040",
    lineHeight: 14,
  },
  ratingValue: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: "#D4A830",
    letterSpacing: 0.2,
  },

  // ── Overview ─────────────────────────────────────────────────────────────
  overview: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: "rgba(255,255,255,0.38)",
    lineHeight: 20,
    paddingHorizontal: 18,
    marginBottom: 12,
    letterSpacing: 0.1,
  },

  // ── Genre pills ──────────────────────────────────────────────────────────
  genreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  genrePill: {
    backgroundColor: "rgba(255,255,255,0.055)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.09)",
  },
  genrePillText: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: TEXT3,
    letterSpacing: 0.3,
  },

  // ── Action row ───────────────────────────────────────────────────────────
  actions: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 14,
    gap: 9,
  },

  // Play — dominant center button
  actionPlay: {
    flex: 1.7,
    shadowColor: RED_DEEP,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 10,
  },
  playGradient: {
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 15,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: `${RED_LIGHT}44`,
  },
  playIcon: {
    fontSize: 19,
    color: "#fff",
    lineHeight: 22,
  },
  playLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 12,
    color: "#fff",
    letterSpacing: 0.4,
  },

  // Save / Details — secondary buttons
  actionSecondary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  actionSecondaryActive: {
    backgroundColor: `${RED_DEEP}30`,
    borderColor: `${RED_LIGHT}44`,
  },
  secIcon: {
    fontSize: 19,
    color: TEXT3,
    lineHeight: 22,
  },
  secIconActive: {
    color: RED_LIGHT,
  },
  secLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: TEXT3,
    letterSpacing: 0.3,
  },
  secLabelActive: {
    color: RED_LIGHT,
  },
});

