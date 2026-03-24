import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/store/authStore";
import { getContinueWatching, getPrimaryImageUrl } from "@/lib/jellyfin/media";
import { MODES } from "@/constants/modes";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import ModeCard from "@/components/ModeCard";
import { SkeletonRow } from "@/components/SkeletonCard";
import type { JellyfinItem } from "@/lib/jellyfin/types";

// ─── Session-persisted last-used mode ────────────────────────────────────────
let _lastUsedModeId: string | null = null;

// ─── Contextual greeting ──────────────────────────────────────────────────────
function getGreeting(): { headline: string; subline: (n: string) => string } {
  const h = new Date().getHours();
  if (h < 5) return { headline: "Still up?", subline: (n) => `Night owl mode, ${n}.` };
  if (h < 12) return { headline: "Start your day right.", subline: (n) => `Good morning, ${n}.` };
  if (h < 17) return { headline: "Good afternoon.", subline: (n) => `Take a break, ${n}.` };
  if (h < 21) return { headline: "Good evening.", subline: (n) => `What's the mood, ${n}?` };
  return { headline: "Winding down?", subline: (n) => `Good night, ${n}.` };
}

// ─── Continue watching card ───────────────────────────────────────────────────
function ContinueCard({ item }: { item: JellyfinItem }) {
  const { serverUrl } = useAuthStore();
  const router = useRouter();
  const CARD_W = 160;

  const imageUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, CARD_W * 2)
      : undefined;

  const progress = item.UserData?.PlayedPercentage ?? 0;

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/player/${item.Id}`);
      }}
      activeOpacity={0.85}
    >
      <View style={cwStyles.card}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[StyleSheet.absoluteFill, { borderRadius: Radii.md }]}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={cwStyles.placeholder}>
            <Text style={cwStyles.placeholderText}>{item.Name[0]}</Text>
          </View>
        )}

        <LinearGradient
          colors={["transparent", "rgba(5,5,7,0.96)"]}
          style={cwStyles.overlay}
        >
          <Text style={cwStyles.title} numberOfLines={1}>{item.Name}</Text>
          {progress > 0 && (
            <View style={cwStyles.progressRow}>
              <View style={cwStyles.progressTrack}>
                <View style={[cwStyles.progressFill, { width: `${progress}%` as any }]} />
              </View>
              <Text style={cwStyles.progressPct}>{Math.round(progress)}%</Text>
            </View>
          )}
        </LinearGradient>

        <View style={cwStyles.resumeBadge}>
          <Text style={cwStyles.resumeText}>▶ Resume</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { serverUrl, token, userId, userName, logout } = useAuthStore();
  const [continueItems, setContinueItems] = useState<JellyfinItem[]>([]);
  const [loadingContinue, setLoadingContinue] = useState(true);
  const [lastUsedModeId, setLastUsedModeId] = useState<string | null>(_lastUsedModeId);

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const sectionAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(sectionAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!serverUrl || !token || !userId) return;
    setLoadingContinue(true);
    getContinueWatching(serverUrl, token, userId, 8)
      .then(setContinueItems)
      .catch(() => {})
      .finally(() => setLoadingContinue(false));
  }, [serverUrl, token, userId]);

  const { headline, subline } = getGreeting();

  const handleQuickPlay = (modeId: string) => {
    _lastUsedModeId = modeId;
    setLastUsedModeId(modeId);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{headline}</Text>
            {userName && (
              <Text style={styles.subGreeting}>{subline(userName)}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              logout();
            }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ─── Modes ──────────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: sectionAnim, gap: Spacing.md }}>
          <Text style={styles.sectionTitle}>How do you want to feel?</Text>
          <View style={styles.modeGrid}>
            {MODES.map((mode, index) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                isRecent={mode.id === lastUsedModeId}
                enterDelay={200 + index * 70}
                onQuickPlay={handleQuickPlay}
              />
            ))}
          </View>
        </Animated.View>

        {/* ─── Continue Watching ──────────────────────────────────────── */}
        {(loadingContinue || continueItems.length > 0) && (
          <Animated.View style={[styles.section, { opacity: sectionAnim }]}>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
            {loadingContinue ? (
              <SkeletonRow count={3} size="medium" />
            ) : (
              <FlatList
                data={continueItems}
                keyExtractor={(item) => item.Id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowContent}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item }) => <ContinueCard item={item} />}
              />
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: 100,
    gap: Spacing.lg,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: Spacing.md,
  },
  headerText: { flex: 1, gap: 3 },
  greeting: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subGreeting: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  logoutBtn: { paddingBottom: 4, paddingLeft: 12 },
  logoutText: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textMuted,
  },

  section: { gap: Spacing.md },
  sectionTitle: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },

  rowContent: { paddingBottom: 4 },
});

// ─── Continue card styles ──────────────────────────────────────────────────────
const cwStyles = StyleSheet.create({
  card: {
    width: 160,
    height: 240,
    borderRadius: Radii.md,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.textMuted,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    justifyContent: "flex-end",
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 6,
  },
  title: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 2.5,
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
  progressPct: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  resumeBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  resumeText: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: "#fff",
    letterSpacing: 0.3,
  },
});
