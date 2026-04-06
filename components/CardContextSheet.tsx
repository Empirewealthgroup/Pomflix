import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
  UIManager,
} from "react-native";
import { Image } from "expo-image";
import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import { useAuthStore } from "@/lib/store/authStore";
import {
  setFavorite,
  getBackdropImageUrl,
  getPrimaryImageUrl,
  formatRuntime,
} from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography } from "@/constants/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EASE_OUT = Easing.out(Easing.quad);

interface CardContextSheetProps {
  item: JellyfinItem | null;
  onClose: () => void;
  onFavoriteChange?: (itemId: string, isFavorite: boolean) => void;
}

// ─── Animated action button (Reanimated scale bounce) ─────────────────────────
function ActionBtn({
  onPress,
  style,
  containerStyle,
  children,
}: {
  onPress: () => void;
  style?: any;
  containerStyle?: any;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.94, { duration: 100 }); }}
      onPressOut={() => { scale.value = withTiming(1,    { duration: 150, easing: Easing.out(Easing.quad) }); }}
      activeOpacity={1}
      style={containerStyle}
    >
      <Reanimated.View style={[animStyle, style]}>{children}</Reanimated.View>
    </TouchableOpacity>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function CardContextSheet({
  item,
  onClose,
  onFavoriteChange,
}: CardContextSheetProps) {
  const { serverUrl, token, userId } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Reanimated shared values (drive all sheet animations)
  const translateY    = useSharedValue(500);
  const shScale       = useSharedValue(0.96);
  const backdropOpacity = useSharedValue(0);
  const dragY         = useSharedValue(0);
  // Shared value so the UI-thread worklet can read expanded state without runOnJS
  const expandedSV    = useSharedValue(false);

  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const [isFavorite, setIsFavorite] = useState(item?.UserData?.IsFavorite ?? false);
  const togglingRef = useRef(false);

  useEffect(() => {
    setIsFavorite(item?.UserData?.IsFavorite ?? false);
    setExpanded(false);
    expandedSV.value = false;
    dragY.value = 0;
  }, [item?.Id]);

  const visible = !!item;

  // Stable JS-thread callbacks for runOnJS calls from the worklet
  const doClose = useCallback(() => { onCloseRef.current(); }, []);
  const doExpand = useCallback(() => {
    setExpanded(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.value = 0;
      translateY.value      = withTiming(0,    { duration: 320, easing: EASE_OUT });
      shScale.value         = withTiming(1,    { duration: 320, easing: EASE_OUT });
      backdropOpacity.value = withTiming(1,    { duration: 220 });
    } else {
      translateY.value      = withTiming(500,  { duration: 220 });
      shScale.value         = withTiming(0.96, { duration: 220 });
      backdropOpacity.value = withTiming(0,    { duration: 180 }, (done) => {
        "worklet";
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  // RNGH pan gesture — runs on the UI thread, reliable on Fabric
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      dragY.value = e.translationY > 0 ? e.translationY : e.translationY * 0.25;
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 600) {
        translateY.value      = withTiming(600, { duration: 220 });
        backdropOpacity.value = withTiming(0,   { duration: 180 });
        dragY.value           = withTiming(0,   { duration: 180 }, (done) => {
          "worklet";
          if (done) runOnJS(doClose)();
        });
      } else if (e.translationY < -40 && !expandedSV.value) {
        expandedSV.value = true;
        dragY.value = withTiming(0, { duration: 200, easing: EASE_OUT });
        runOnJS(doExpand)();
      } else {
        dragY.value = withTiming(0, { duration: 200, easing: EASE_OUT });
      }
    });

  // Animated styles
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value + dragY.value },
      { scale: shScale.value },
    ],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(dragY.value, [-100, 0, 300], [-14, 0, 20], Extrapolation.CLAMP),
    }],
  }));

  if (!mounted || !item) return null;

  const backdropUrl =
    serverUrl && (item.BackdropImageTags?.length ?? 0) > 0
      ? getBackdropImageUrl(serverUrl, item.Id, item.BackdropImageTags![0], 800)
      : serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, 800)
      : null;

  const year    = item.ProductionYear ?? null;
  const runtime = item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null;
  const rating  = item.CommunityRating ? item.CommunityRating.toFixed(1) : null;

  const isEpisode = item.Type === "Episode";
  const favoriteTargetId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;

  const typeBadge =
    item.Type === "Series" ? "SERIES" :
    item.Type === "Episode" && item.ParentIndexNumber != null && item.IndexNumber != null
      ? `S${item.ParentIndexNumber}  E${item.IndexNumber}`
      : item.Type === "Episode" ? "EPISODE"
      : "FILM";

  const handleToggleFavorite = async () => {
    if (togglingRef.current || !serverUrl || !token || !userId) return;
    togglingRef.current = true;
    const next = !isFavorite;
    setIsFavorite(next);
    Haptics.impactAsync(next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    try {
      await setFavorite(serverUrl, token, userId, favoriteTargetId, next);
      onFavoriteChange?.(item.Id, next);
    } catch {
      setIsFavorite(!next);
    } finally {
      togglingRef.current = false;
    }
  };

  const handlePlay = () => {
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.Type === "Series") {
      router.push({ pathname: "/series/[seriesId]", params: { seriesId: item.Id } });
    } else {
      router.push({ pathname: "/player/[itemId]", params: { itemId: item.Id, itemName: item.Name ?? "" } });
    }
  };

  const handleDetails = () => {
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isEpisode && item.SeriesId) {
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
      <Reanimated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Reanimated.View>

      {/* Sheet — GestureDetector gives reliable pan on Fabric/New Architecture */}
      <GestureDetector gesture={panGesture}>
        <Reanimated.View style={[s.sheet, sheetStyle, { paddingBottom: insets.bottom + 16 }]}>

          {/* Handle */}
          <View style={s.handleArea}>
            <View style={s.handle} />
            {!expanded && (
              <Text style={s.expandHint}>↑  swipe for more  ↓  to close</Text>
            )}
          </View>

          {/* Hero card */}
          <View style={s.hero}>
            <Reanimated.View style={[StyleSheet.absoluteFill, heroParallaxStyle]}>
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
            </Reanimated.View>
            <LinearGradient
              colors={["rgba(0,0,0,0.52)", "transparent"]}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: "44%" }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["transparent", "rgba(10,8,12,0.88)", "#0F0F14"]}
              locations={[0.28, 0.76, 1]}
              style={s.heroBottomGrad}
              pointerEvents="none"
            />
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>{typeBadge}</Text>
            </View>
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

          {/* Actions */}
          <View style={s.actions}>
            <ActionBtn onPress={handlePlay} style={s.actionPlay}>
              <LinearGradient
                colors={["#AD1A2E", "#900020"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.playGradient}
              >
                <Text style={s.playIcon}>▶</Text>
                <Text style={s.playLabel}>
                  {item.Type === "Series" ? "Play Episodes" : "Play"}
                </Text>
              </LinearGradient>
            </ActionBtn>

            <View style={s.actionsSecondaryRow}>
              <ActionBtn
                onPress={handleToggleFavorite}
                containerStyle={s.secBtnContainer}
                style={[s.actionSecondary, isFavorite && s.actionSecondaryActive]}
              >
                <Text style={[s.secIcon, isFavorite && s.secIconActive]}>
                  {isFavorite ? "♥" : "♡"}
                </Text>
                <Text style={[s.secLabel, isFavorite && s.secLabelActive]}>
                  {isFavorite ? "Saved" : isEpisode ? "Save Show" : "Save"}
                </Text>
              </ActionBtn>

              <ActionBtn
                onPress={handleDetails}
                containerStyle={s.secBtnContainer}
                style={s.actionSecondary}
              >
                <Text style={s.secIcon}>ⓘ</Text>
                <Text style={s.secLabel}>{isEpisode ? "Show Details" : "More Info"}</Text>
              </ActionBtn>
            </View>
          </View>

        </Reanimated.View>
      </GestureDetector>
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

  // ── Action area ──────────────────────────────────────────────────────────
  actions: {
    paddingHorizontal: 14,
    gap: 10,
  },

  // Play — full-width row dominant button
  actionPlay: {
    shadowColor: RED_DEEP,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 10,
  },
  playGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    paddingVertical: 17,
    paddingHorizontal: 28,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: `${RED_LIGHT}55`,
  },
  playIcon: {
    fontSize: 16,
    color: "#fff",
    lineHeight: 20,
  },
  playLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 16,
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Secondary button row beneath Play
  actionsSecondaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  // Container — owns the flex so TouchableOpacity stretches equally
  secBtnContainer: {
    flex: 1,
  },

  // Save / Details — secondary buttons
  actionSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
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
    fontSize: 16,
    color: TEXT2,
    lineHeight: 20,
  },
  secIconActive: {
    color: RED_LIGHT,
  },
  secLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: TEXT2,
    letterSpacing: 0.1,
  },
  secLabelActive: {
    color: RED_LIGHT,
  },
});

