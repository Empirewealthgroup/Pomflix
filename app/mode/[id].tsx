import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { getModeById } from "@/constants/modes";
import { useAuthStore } from "@/lib/store/authStore";
import { useSessionStore } from "@/lib/store/sessionStore";
import { getSuggestionsForMode, getBackdropImageUrl, getPrimaryImageUrl, formatRuntime } from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import { useFeedbackStore } from "@/lib/store/feedbackStore";

const { width } = Dimensions.get("window");

export default function ModeScreen() {
  const { id, autoPlay } = useLocalSearchParams<{ id: string; autoPlay?: string }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();
  const mode = getModeById(id);

  // Visible cards (max 5) + reserve pool
  const [visibleItems, setVisibleItems] = useState<JellyfinItem[]>([]);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const poolRef = useRef<JellyfinItem[]>([]);
  const isFetchingMoreRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const { startSession } = useSessionStore();
  const { getFeedback, isSkipped } = useFeedbackStore();

  // Apply feedback scoring: filter skipped, surface perfect
  const applyFeedback = (items: JellyfinItem[]) => {
    const valid = items.filter((i) => !isSkipped(i.Id));
    valid.sort((a, b) => {
      const pa = getFeedback(a.Id) === "perfect" ? -1 : 0;
      const pb = getFeedback(b.Id) === "perfect" ? -1 : 0;
      return pa - pb;
    });
    return valid;
  };

  const VISIBLE_COUNT = 5;
  const FETCH_COUNT = 20;

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  // Color-morph dissolve: starts opaque (matches home overlay), fades to reveal content
  const colorDissolvAnim = useRef(new Animated.Value(1)).current;
  // Gradient fades in simultaneously as the overlay dissolves
  const gradientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(colorDissolvAnim, { toValue: 0, duration: 440, delay: 50, useNativeDriver: true }),
      Animated.timing(gradientAnim, { toValue: 1, duration: 440, delay: 50, useNativeDriver: true }),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(listAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  useEffect(() => {
    if (!mode || !serverUrl || !token || !userId) return;
    // Start / resume the session for this mode
    startSession(mode.id, mode.label, mode.icon, mode.colors.base);
    setLoading(true);
    getSuggestionsForMode(serverUrl, token, userId, mode, FETCH_COUNT)
      .then((items) => {
        const ranked = applyFeedback(items);
        const visible = ranked.slice(0, VISIBLE_COUNT);
        poolRef.current = ranked.slice(VISIBLE_COUNT);
        setVisibleItems(visible);
        // Long-press quick play: jump straight to first item
        if (autoPlay === "1" && ranked.length > 0) {
          router.replace({
            pathname: "/player/[itemId]",
            params: { itemId: ranked[0].Id, itemName: ranked[0].Name ?? "" },
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mode?.id]);

  if (!mode) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: Colors.textSecondary, margin: Spacing.lg }}>Mode not found.</Text>
      </SafeAreaView>
    );
  }

  const handleDismiss = useCallback((itemId: string) => {
    const next = poolRef.current.shift();
    setVisibleItems((prev) => {
      const filtered = prev.filter((i) => i.Id !== itemId);
      if (!next) return filtered;
      return [...filtered, next];
    });
    if (next) {
      setNewItemIds((prev) => new Set(prev).add(next.Id));
      setTimeout(() => {
        setNewItemIds((prev) => {
          const s = new Set(prev);
          s.delete(next.Id);
          return s;
        });
      }, 500);
    }
    // Silently refetch when pool runs low
    if (poolRef.current.length < 3 && !isFetchingMoreRef.current && mode && serverUrl && token && userId) {
      isFetchingMoreRef.current = true;
      getSuggestionsForMode(serverUrl, token, userId, mode, FETCH_COUNT)
        .then((fresh) => { poolRef.current = [...poolRef.current, ...applyFeedback(fresh)]; })
        .catch(() => {})
        .finally(() => { isFetchingMoreRef.current = false; });
    }
  }, [mode, serverUrl, token, userId]);

  const handlePlay = (itemId: string, itemName?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/player/[itemId]",
      params: { itemId, itemName: itemName ?? "" },
    });
  };

  const handleSurpriseMe = () => {
    if (visibleItems.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const pick = visibleItems[Math.floor(Math.random() * visibleItems.length)];
    router.push({
      pathname: "/player/[itemId]",
      params: { itemId: pick.Id, itemName: pick.Name ?? "" },
    });
  };

  return (
    <View style={styles.root}>
      {/* Ambient background — fades in with the dissolve */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gradientAnim }]} pointerEvents="none">
        <LinearGradient
          colors={[`${mode.colors.base}CC`, `${mode.colors.base}33`, Colors.bg]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <SafeAreaView style={styles.safe}>
        {/* Back */}
        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={styles.backText}>← All modes</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Mode identity */}
          <Animated.View
            style={[
              styles.identity,
              {
                opacity: headerAnim,
                transform: [{
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1], outputRange: [16, 0],
                  }),
                }],
              },
            ]}
          >
            <Text style={[styles.modeIcon, { color: mode.colors.accent }]}>{mode.icon}</Text>
            <Text style={styles.modeLabel}>{mode.label}</Text>
            <Text style={[styles.modeTagline, { color: mode.colors.textAccent }]}>
              {mode.tagline}
            </Text>
            <Text style={styles.modeDescription}>{mode.description}</Text>
          </Animated.View>

          {/* Suggestions */}
          <Animated.View style={[styles.suggestionsSection, { opacity: listAnim }]}>
            <Text style={styles.sectionLabel}>Curated for this moment</Text>

            {loading ? (
              <ActivityIndicator color={mode.colors.accent} style={{ marginTop: Spacing.xl }} />
            ) : visibleItems.length === 0 ? (
              <Text style={styles.empty}>No suggestions found. Try the Library.</Text>
            ) : (
              <View style={styles.suggestionsList}>
                {visibleItems.map((item) => {
                  const isSelected = selected === item.Id;
                  const imageUrl =
                    serverUrl && item.BackdropImageTags?.[0]
                      ? getBackdropImageUrl(serverUrl, item.Id, item.BackdropImageTags[0], width * 2)
                      : serverUrl && item.ImageTags?.Primary
                      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, 600)
                      : undefined;

                  return (
                    <SuggestionCard
                      key={item.Id}
                      item={item}
                      imageUrl={imageUrl}
                      isSelected={isSelected}
                      accentColor={mode.colors.accent}
                      isNew={newItemIds.has(item.Id)}
                      onToggle={() => setSelected(isSelected ? null : item.Id)}
                      onPlay={() => handlePlay(item.Id, item.Name)}
                      onDismiss={() => handleDismiss(item.Id)}
                    />
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* Library shortcut */}
          <TouchableOpacity
            style={styles.surpriseBtn}
            onPress={handleSurpriseMe}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={[`${mode.colors.accent}22`, "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={[styles.surpriseBtnText, { color: mode.colors.accent }]}>
              ⚡ Surprise Me
            </Text>
          </TouchableOpacity>

          {/* Library shortcut */}
          <TouchableOpacity
            style={styles.libraryLink}
            onPress={() => router.push("/(app)/library")}
          >
            <Text style={[styles.libraryLinkText, { color: mode.colors.textAccent }]}>
              Browse full library →
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Color-morph dissolve overlay — bridges from home screen flood fill */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: mode.colors.base, opacity: colorDissolvAnim },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  back: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },

  identity: { alignItems: "center", gap: Spacing.sm, paddingTop: Spacing.md },
  modeIcon: { fontSize: 40 },
  modeLabel: {
    fontFamily: Typography.display,
    fontSize: 40,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  modeTagline: {
    fontFamily: Typography.displayItalic,
    fontSize: 18,
  },
  modeDescription: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },

  suggestionsSection: { gap: Spacing.md },
  sectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  suggestionsList: { gap: Spacing.md },

  suggestion: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radii.lg,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
  },

  thumb: {
    width: "100%",
    height: 160,
    backgroundColor: Colors.surface,
  },
  noThumb: { backgroundColor: Colors.surfaceRaised },

  suggestionInfo: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  suggestionInfoTop: { gap: Spacing.xs },
  suggestionTitle: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  suggestionMeta: { flexDirection: "row", gap: Spacing.md },
  metaText: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  overview: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 2,
  },

  playBtn: {
    borderRadius: Radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  playBtnText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 15,
    color: Colors.bg,
  },

  empty: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },

  libraryLink: { alignItems: "center", paddingVertical: Spacing.sm },
  libraryLinkText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
  },

  surpriseBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.md,
    paddingVertical: 14,
    overflow: "hidden",
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  surpriseBtnText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 15,
    letterSpacing: 0.2,
  },

  swipeHint: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 18,
    zIndex: 10,
  },
  swipeHintLeft: { left: 0 },
  swipeHintRight: { right: 0 },
  swipeHintText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});

// --- Suggestion card with swipe-to-dismiss ---
interface SuggestionCardProps {
  item: JellyfinItem;
  imageUrl: string | undefined;
  isSelected: boolean;
  accentColor: string;
  isNew?: boolean;
  onToggle: () => void;
  onPlay: () => void;
  onDismiss: () => void;
}

const SWIPE_THRESHOLD = 40;

function SuggestionCard({
  item,
  imageUrl,
  isSelected,
  accentColor,
  isNew = false,
  onToggle,
  onPlay,
  onDismiss,
}: SuggestionCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const enterY = useRef(new Animated.Value(isNew ? 32 : 0)).current;
  const enterOpacity = useRef(new Animated.Value(isNew ? 0 : 1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(enterY, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(enterOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
        cardOpacity.setValue(1 - Math.min(Math.abs(gs.dx) / 160, 0.6));
      },
      onPanResponderRelease: (_, gs) => {
        const shouldDismiss = Math.abs(gs.dx) > SWIPE_THRESHOLD || Math.abs(gs.vx) > 0.4;
        if (shouldDismiss) {
          const flyTo = gs.dx > 0 || gs.vx > 0 ? width + 60 : -(width + 60);
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: flyTo,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
              toValue: 0,
              duration: 140,
              useNativeDriver: true,
            }),
          ]).start(() => onDismiss());
        } else {
          Animated.parallel([
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 200, friction: 16 }),
            Animated.timing(cardOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const pressIn = () =>
    Animated.timing(scale, { toValue: 0.985, duration: 80, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 130, useNativeDriver: true }).start();

  const leftHintOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: "clamp",
  });
  const rightHintOpacity = translateX.interpolate({
    inputRange: [0, 20, SWIPE_THRESHOLD],
    outputRange: [0, 0.3, 1],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[
        styles.suggestion,
        {
          opacity: Animated.multiply(cardOpacity, enterOpacity) as any,
          transform: [{ scale }, { translateX }, { translateY: enterY }],
        },
        isSelected && { borderColor: `${accentColor}88` },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Swipe hint left */}
      <Animated.View
        pointerEvents="none"
        style={[styles.swipeHint, styles.swipeHintLeft, { opacity: leftHintOpacity }]}
      >
        <Text style={[styles.swipeHintText, { color: accentColor }]}>{"<"} SKIP</Text>
      </Animated.View>
      {/* Swipe hint right */}
      <Animated.View
        pointerEvents="none"
        style={[styles.swipeHint, styles.swipeHintRight, { opacity: rightHintOpacity }]}
      >
        <Text style={[styles.swipeHintText, { color: accentColor }]}>SKIP {">"}</Text>
      </Animated.View>

      <TouchableOpacity
        onPress={onToggle}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
      >
        <View style={styles.thumb}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.noThumb]} />
          )}
          <LinearGradient
            colors={["transparent", "rgba(10,10,12,0.72)"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        <View style={styles.suggestionInfo}>
          <View style={styles.suggestionInfoTop}>
            <Text style={styles.suggestionTitle} numberOfLines={2}>{item.Name}</Text>
            <View style={styles.suggestionMeta}>
              {item.ProductionYear && (
                <Text style={styles.metaText}>{item.ProductionYear}</Text>
              )}
              {item.RunTimeTicks && (
                <Text style={styles.metaText}>{formatRuntime(item.RunTimeTicks)}</Text>
              )}
              {item.CommunityRating && (
                <Text style={styles.metaText}>{"*"} {item.CommunityRating.toFixed(1)}</Text>
              )}
            </View>
            {item.Overview && (
              <Text style={styles.overview} numberOfLines={isSelected ? 6 : 2}>
                {item.Overview}
              </Text>
            )}
          </View>

          <TouchableOpacity onPress={onPlay} activeOpacity={0.88}>
            <LinearGradient
              colors={[accentColor, `${accentColor}BB`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.playBtn}
            >
              <Text style={styles.playBtnText}>Play</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
