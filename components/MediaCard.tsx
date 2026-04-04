import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { getPrimaryImageUrl, formatRuntime } from "@/lib/jellyfin/media";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import { useAuthStore } from "@/lib/store/authStore";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

interface MediaCardProps {
  item: JellyfinItem;
  size?: "small" | "medium" | "large";
  showMeta?: boolean;
  /** Navigate to item detail screen instead of directly to player */
  navigateTo?: "player" | "item";
  /** Custom press handler — overrides built-in navigation */
  onPress?: () => void;
}

const SIZES = {
  small: { width: 120, height: 180 },
  medium: { width: 160, height: 240 },
  large: { width: width - Spacing.screen * 2, height: 220 },
};

export default function MediaCard({
  item,
  size = "medium",
  showMeta = true,
  navigateTo = "player",
  onPress,
}: MediaCardProps) {
  const router = useRouter();
  const { serverUrl } = useAuthStore();
  const dims = SIZES[size];

  const imageUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, dims.width * 2)
      : undefined;

  const progress = item.UserData?.PlayedPercentage ?? 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) { onPress(); return; }
    if (navigateTo === "item") {
      router.push(`/item/${item.Id}`);
    } else {
      router.push(`/player/${item.Id}`);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.wrapper, { width: dims.width }]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      {/* Poster */}
      <View style={[styles.poster, { width: dims.width, height: dims.height }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noImage]}>
            <Text style={styles.noImageText}>{item.Name[0]}</Text>
          </View>
        )}

        {/* Bottom gradient */}
        <LinearGradient
          colors={["transparent", "rgba(10,10,12,0.85)"]}
          style={styles.posterGradient}
          pointerEvents="none"
        />

        {/* Progress bar */}
        {progress > 0 && progress < 100 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
        )}
      </View>

      {/* Meta */}
      {showMeta && (
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{item.Name}</Text>
          {!!item.ProductionYear && (
            <Text style={styles.sub}>
              {item.ProductionYear}
              {item.RunTimeTicks ? `  ·  ${formatRuntime(item.RunTimeTicks)}` : ""}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  poster: {
    borderRadius: Radii.md,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
  },
  noImage: {
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    fontFamily: Typography.display,
    fontSize: 48,
    color: Colors.textMuted,
  },
  posterGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  progressBar: {
    height: 3,
    backgroundColor: Colors.brand,
    borderRadius: 2,
  },
  meta: { gap: 2, paddingHorizontal: 2 },
  title: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  sub: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
