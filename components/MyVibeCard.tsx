import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { getPrimaryImageUrl } from "@/lib/jellyfin/media";
import { useAuthStore } from "@/lib/store/authStore";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

const { width } = Dimensions.get("window");
const CARD_W = width - Spacing.screen * 2;
const CARD_H = 180;
const THUMB_W = 60;
const THUMB_H = 88;

// Fan positions: i=0 is the front/rightmost poster, higher i = further behind/left
const FAN = [
  { right: 14,  top: 18, rotate: "5deg"   },
  { right: 46,  top: 12, rotate: "-1deg"  },
  { right: 78,  top: 16, rotate: "-7deg"  },
  { right: 108, top: 22, rotate: "-12deg" },
  { right: 132, top: 28, rotate: "-15deg" },
] as const;

// Show the hold hint only once per session
let _myVibeHintShown = false;

interface MyVibeCardProps {
  savedItems: JellyfinItem[];
  loading?: boolean;
  onShufflePlay: (item: JellyfinItem) => void;
  enterDelay?: number;
}

export default function MyVibeCard({
  savedItems,
  loading = false,
  onShufflePlay,
  enterDelay = 200,
}: MyVibeCardProps) {
  const router = useRouter();
  const { serverUrl } = useAuthStore();

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const hintOpacity = useRef(new Animated.Value(_myVibeHintShown ? 0 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay: enterDelay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay: enterDelay,
        useNativeDriver: true,
      }),
    ]).start();

    if (_myVibeHintShown) return;
    const t = setTimeout(() => {
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start(() => {
        _myVibeHintShown = true;
      });
    }, 2800);
    return () => clearTimeout(t);
  }, []);

  const handlePressIn = () =>
    Animated.spring(scale, {
      toValue: 0.975,
      friction: 8,
      tension: 300,
      useNativeDriver: true,
    }).start();

  const handlePressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/myvibe" as never);
  };

  const handleLongPress = () => {
    if (savedItems.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const pick = savedItems[Math.floor(Math.random() * savedItems.length)];
    onShufflePlay(pick);
  };

  const thumbs = savedItems.slice(0, Math.min(savedItems.length, 5));
  const count = savedItems.length;

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateY }, { scale }] }}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        delayLongPress={420}
        activeOpacity={1}
      >
        <LinearGradient
          colors={["#3A0D19", "#230810", "#0F0305"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Glow blobs */}
          <View style={styles.glowTopLeft} pointerEvents="none" />
          <View style={styles.glowBottomRight} pointerEvents="none" />

          {/* Thumbnail fan — rendered back-to-front for correct stacking */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {thumbs.length > 0
              ? [...thumbs].reverse().map((item, reversedIdx) => {
                  const i = thumbs.length - 1 - reversedIdx; // 0 = front
                  const fan = FAN[i];
                  const imgUrl =
                    serverUrl && item.ImageTags?.Primary
                      ? getPrimaryImageUrl(
                          serverUrl,
                          item.Id,
                          item.ImageTags.Primary,
                          THUMB_W * 2
                        )
                      : null;
                  return (
                    <View
                      key={item.Id}
                      style={[
                        styles.thumb,
                        {
                          right: fan.right,
                          top: fan.top,
                          transform: [{ rotate: fan.rotate }],
                          zIndex: i + 1,
                        },
                      ]}
                    >
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={180}
                        />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, styles.thumbPlaceholder]} />
                      )}
                      {/* Subtle edge shadow on each thumb */}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.22)"]}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  );
                })
              : loading
              ? [0, 1, 2].map((i) => (
                  <View
                    key={`skel-${i}`}
                    style={[
                      styles.thumb,
                      styles.thumbSkeleton,
                      {
                        right: FAN[i].right,
                        top: FAN[i].top,
                        transform: [{ rotate: FAN[i].rotate }],
                        zIndex: i + 1,
                      },
                    ]}
                  />
                ))
              : null}
          </View>

          {/* Gradient veil: solid left → transparent right, keeps text readable */}
          <LinearGradient
            colors={["#0F0305", "rgba(15,3,5,0.9)", "rgba(15,3,5,0.5)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.62, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Bottom scrim behind text */}
          <LinearGradient
            colors={["transparent", "rgba(8,2,3,0.82)"]}
            style={styles.bottomScrim}
            pointerEvents="none"
          />

          {/* Text content — bottom left */}
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.heartIcon}>♥</Text>
              <Text style={styles.title}>My Vibe</Text>
              {count > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{count}</Text>
                </View>
              )}
            </View>

            <Text style={styles.tagline} numberOfLines={1}>
              {count === 0
                ? "Save titles to build your vibe"
                : count === 1
                ? "1 title saved"
                : `${count} titles saved`}
            </Text>

            <Animated.View style={[styles.hintRow, { opacity: hintOpacity }]}>
              <Text style={styles.hintText}>Hold to shuffle</Text>
              <Text style={styles.hintArrow}> →</Text>
            </Animated.View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: Radii.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
    borderWidth: 0.5,
    borderColor: "rgba(139,26,46,0.3)",
  },

  glowTopLeft: {
    position: "absolute",
    top: -40,
    left: -20,
    width: 200,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#8B1A2E",
    opacity: 0.2,
  },
  glowBottomRight: {
    position: "absolute",
    bottom: -20,
    right: 60,
    width: 140,
    height: 100,
    borderRadius: 70,
    backgroundColor: "#C02040",
    opacity: 0.1,
  },

  thumb: {
    position: "absolute",
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: Radii.sm,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    // Drop shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  thumbPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  thumbSkeleton: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  bottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  content: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 4,
    maxWidth: "58%",
    zIndex: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heartIcon: {
    fontSize: 15,
    color: "#C9304A",
    lineHeight: 20,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: "rgba(139,26,46,0.45)",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(201,48,74,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: "#C9304A",
  },
  tagline: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: "rgba(255,255,255,0.48)",
    lineHeight: 17,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  hintText: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: "rgba(255,255,255,0.28)",
  },
  hintArrow: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
  },
});
