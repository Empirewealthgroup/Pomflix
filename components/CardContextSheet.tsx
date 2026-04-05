import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { useRef, useEffect, useState } from "react";
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

interface CardContextSheetProps {
  item: JellyfinItem | null;
  onClose: () => void;
  /** Called after favorite is toggled so parent can refresh isFavorite state */
  onFavoriteChange?: (itemId: string, isFavorite: boolean) => void;
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
  const [mounted, setMounted] = useState(false);

  // Local optimistic favorite state — seeded from item prop
  const [isFavorite, setIsFavorite] = useState(item?.UserData?.IsFavorite ?? false);
  const togglingRef = useRef(false);

  // Sync when item changes
  useEffect(() => {
    setIsFavorite(item?.UserData?.IsFavorite ?? false);
  }, [item?.Id]);

  const visible = !!item;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 18,
          tension: 130,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted || !item) return null;

  const backdropUrl =
    serverUrl && (item.BackdropImageTags?.length ?? 0) > 0
      ? getBackdropImageUrl(serverUrl, item.Id, item.BackdropImageTags![0], 800)
      : serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, 800)
      : null;

  const meta = [
    item.ProductionYear,
    item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null,
    item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const typeBadge = item.Type === "Series" ? "SERIES" : "FILM";

  const handleToggleFavorite = async () => {
    if (togglingRef.current || !serverUrl || !token || !userId) return;
    togglingRef.current = true;
    const next = !isFavorite;
    setIsFavorite(next); // optimistic
    Haptics.impactAsync(
      next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    try {
      await setFavorite(serverUrl, token, userId, item.Id, next);
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
    } else {
      router.push({
        pathname: "/player/[itemId]",
        params: { itemId: item.Id, itemName: item.Name ?? "" },
      });
    }
  };

  const handleDetails = () => {
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/item/${item.Id}`);
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
          { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={s.handle} />

        {/* Hero image */}
        <View style={s.hero}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surfaceRaised }]} />
          )}
          <LinearGradient
            colors={["transparent", "rgba(16,16,20,0.96)"]}
            style={s.heroGrad}
            pointerEvents="none"
          />
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>{typeBadge}</Text>
          </View>
          <View style={s.heroMeta}>
            <Text style={s.heroTitle} numberOfLines={2}>
              {item.Name}
            </Text>
            {meta ? <Text style={s.heroSub}>{meta}</Text> : null}
          </View>
        </View>

        {/* Overview */}
        {!!item.Overview && (
          <Text style={s.overview} numberOfLines={3}>
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
          {/* Favorite */}
          <TouchableOpacity
            style={[s.actionBtn, isFavorite && s.actionBtnActive]}
            onPress={handleToggleFavorite}
            activeOpacity={0.78}
          >
            <Text style={[s.actionIcon, isFavorite && s.actionIconActive]}>
              {isFavorite ? "♥" : "♡"}
            </Text>
            <Text style={[s.actionLabel, isFavorite && s.actionLabelActive]}>
              {isFavorite ? "Saved" : "Save"}
            </Text>
          </TouchableOpacity>

          {/* Play */}
          <TouchableOpacity style={[s.actionBtn, s.actionBtnPlay]} onPress={handlePlay} activeOpacity={0.82}>
            <Text style={s.actionIconPlay}>▶</Text>
            <Text style={s.actionLabelPlay}>
              {item.Type === "Series" ? "Episodes" : "Play"}
            </Text>
          </TouchableOpacity>

          {/* Details */}
          <TouchableOpacity style={s.actionBtn} onPress={handleDetails} activeOpacity={0.78}>
            <Text style={s.actionIcon}>ⓘ</Text>
            <Text style={s.actionLabel}>Details</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#F2EDE8";
const TEXT2 = "rgba(255,255,255,0.5)";
const TEXT3 = "rgba(255,255,255,0.28)";
const RED = "#A32035";
const RED_LIGHT = "#FF5A5F";

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.68)",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#13131A",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    paddingTop: 10,
    zIndex: 11,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 12,
  },

  // Hero
  hero: {
    height: 180,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroGrad: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBadge: {
    position: "absolute",
    top: 10,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroBadgeText: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.5,
  },
  heroMeta: {
    position: "absolute",
    bottom: 12,
    left: 14,
    right: 14,
  },
  heroTitle: {
    fontFamily: Typography.displayBold,
    fontSize: 20,
    color: TEXT,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  heroSub: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: TEXT2,
  },

  // Overview
  overview: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: TEXT2,
    lineHeight: 19,
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  // Genres
  genreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  genrePill: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  genrePillText: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: TEXT3,
  },

  // Actions row
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.8,
    borderColor: BORDER,
  },
  actionBtnActive: {
    backgroundColor: `${RED}22`,
    borderColor: `${RED_LIGHT}55`,
  },
  actionBtnPlay: {
    backgroundColor: Colors.brand,
    borderColor: "transparent",
  },
  actionIcon: {
    fontSize: 20,
    color: TEXT2,
  },
  actionIconActive: {
    color: RED_LIGHT,
  },
  actionIconPlay: {
    fontSize: 18,
    color: "#fff",
  },
  actionLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: TEXT2,
  },
  actionLabelActive: {
    color: RED_LIGHT,
  },
  actionLabelPlay: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: "#fff",
  },
});
