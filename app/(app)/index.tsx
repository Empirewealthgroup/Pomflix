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
import { useSessionStore } from "@/lib/store/sessionStore";
import type { ActiveSession } from "@/lib/store/sessionStore";
import { useOnboardingStore } from "@/lib/store/onboardingStore";
import { getContinueWatching, getPrimaryImageUrl } from "@/lib/jellyfin/media";
import { MODES, type ModeId } from "@/constants/modes";
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
// ─── Adaptive time-of-day context ──────────────────────────────────────────
function getTimeContext(): { glowColor: string; recommendedModeId: ModeId } {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return { glowColor: "#C47A2A", recommendedModeId: "energy" };
  if (h >= 11 && h < 17) return { glowColor: "#1B3A5C", recommendedModeId: "focus" };
  if (h >= 17 && h < 21) return { glowColor: "#3D2B5E", recommendedModeId: "wind-down" };
  return { glowColor: "#5E2240", recommendedModeId: "escape" };
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
        router.push({
          pathname: "/player/[itemId]",
          params: { itemId: item.Id, itemName: item.Name ?? "" },
        });
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

// ─── Session resume banner ───────────────────────────────────────────────────
function SessionBanner({
  session,
  onContinue,
  onDismiss,
}: {
  session: ActiveSession;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  const elapsed = Math.floor((Date.now() - session.startTime) / 60_000);
  const elapsedLabel =
    elapsed < 1 ? "just now" :
    elapsed < 60 ? `${elapsed}m ago` :
    `${Math.floor(elapsed / 60)}h ${elapsed % 60}m ago`;
  return (
    <TouchableOpacity onPress={onContinue} activeOpacity={0.88} style={[sbStyles.card, { borderColor: `${session.modeColor}55` }]}>
      <LinearGradient
        colors={[`${session.modeColor}2A`, "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={sbStyles.left}>
        <Text style={[sbStyles.icon, { color: session.modeColor }]}>{session.modeIcon}</Text>
        <View style={sbStyles.textCol}>
          <Text style={sbStyles.label}>
            Continue your {session.modeLabel}  ·  {elapsedLabel}
          </Text>
          {session.lastItemName ? (
            <View style={sbStyles.itemRow}>
              <View style={sbStyles.progressTrack}>
                <View
                  style={[
                    sbStyles.progressFill,
                    { width: `${session.lastItemProgress}%` as any, backgroundColor: session.modeColor },
                  ]}
                />
              </View>
              <Text style={sbStyles.itemName} numberOfLines={1}>
                {session.lastItemName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <TouchableOpacity onPress={onDismiss} hitSlop={10} style={sbStyles.dismiss}>
        <Text style={sbStyles.dismissText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { serverUrl, token, userId, userName, logout, isNewLogin, clearNewLogin } = useAuthStore();
  const { currentSession, clearSession, loadStoredSession } = useSessionStore();
  const { hasSeen, markSeen, loadOnboarding } = useOnboardingStore();
  const [continueItems, setContinueItems] = useState<JellyfinItem[]>([]);
  const [loadingContinue, setLoadingContinue] = useState(true);
  const [lastUsedModeId, setLastUsedModeId] = useState<string | null>(_lastUsedModeId);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Adaptive time context
  const { glowColor, recommendedModeId } = getTimeContext();

  // Color-morph transition overlay
  const [overlayColor, setOverlayColor] = useState("#000");
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Welcome overlay (fresh login only)
  const welcomeAnim = useRef(new Animated.Value(isNewLogin ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(isNewLogin ? 0.7 : 1)).current;

  // Onboarding overlay
  const onboardingSlideAnim = useRef(new Animated.Value(60)).current;
  const onboardingFadeAnim = useRef(new Animated.Value(0)).current;

  // Keep a ref to latest hasSeen so the welcome timeout can read it fresh
  const hasSeenRef = useRef(hasSeen);
  useEffect(() => { hasSeenRef.current = hasSeen; }, [hasSeen]);

  const handleModeTransition = (color: string, navigate: () => void) => {
    setOverlayColor(color);
    Animated.timing(overlayAnim, {
      toValue: 1,
      duration: 340,
      useNativeDriver: true,
    }).start(() => {
      navigate();
      setTimeout(() => overlayAnim.setValue(0), 600);
    });
  };

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const sectionAnim = useRef(new Animated.Value(0)).current;

  const runHomeEntrance = () => {
    Animated.sequence([
      Animated.timing(headerAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(sectionAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  };

  const dismissOnboarding = async () => {
    await markSeen();
    Animated.parallel([
      Animated.timing(onboardingSlideAnim, { toValue: 60, duration: 340, useNativeDriver: true }),
      Animated.timing(onboardingFadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      setShowOnboarding(false);
      runHomeEntrance();
    });
  };

  useEffect(() => {
    if (isNewLogin) {
      Animated.spring(logoScale, {
        toValue: 1, friction: 6, tension: 120, useNativeDriver: true,
      }).start();

      // Fade welcome out after 900ms, then show onboarding (first time) or home
      const t = setTimeout(() => {
        Animated.timing(welcomeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          if (!hasSeenRef.current) {
            setShowOnboarding(true);
            Animated.parallel([
              Animated.spring(onboardingSlideAnim, {
                toValue: 0, friction: 10, tension: 120, useNativeDriver: true,
              }),
              Animated.timing(onboardingFadeAnim, {
                toValue: 1, duration: 260, useNativeDriver: true,
              }),
            ]).start();
          } else {
            runHomeEntrance();
          }
        });
        clearNewLogin();
      }, 900);
      return () => clearTimeout(t);
    }

    // Returning user — straight entrance
    runHomeEntrance();
  }, []);

  useEffect(() => { loadStoredSession(); loadOnboarding(); }, []);

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
      {/* ─── Adaptive background glow ─── */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.adaptiveGlow,
          { backgroundColor: glowColor },
        ]}
      />
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

          {/* ─── Session resume banner ─── */}
          {currentSession && (
            <SessionBanner
              session={currentSession}
              onContinue={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/mode/${currentSession.modeId}`);
              }}
              onDismiss={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                clearSession();
              }}
            />
          )}
          <View style={styles.modeGrid}>
            {MODES.map((mode, index) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                isRecent={mode.id === lastUsedModeId}
                isRecommended={mode.id === recommendedModeId}
                enterDelay={200 + index * 70}
                onQuickPlay={handleQuickPlay}
                onTransition={handleModeTransition}
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

      {/* ── Mode transition color flood ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: overlayColor, opacity: overlayAnim },
        ]}
      />

      {/* ── Onboarding overlay (first login only) ── */}
      {showOnboarding && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.onboardingBackdrop,
            { opacity: onboardingFadeAnim },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.onboardingCard,
              { transform: [{ translateY: onboardingSlideAnim }] },
            ]}
          >
            <Text style={styles.obIcon}>◈</Text>
            <Text style={styles.obHeadline}>Pomflix is different.</Text>
            <Text style={styles.obBody}>
              Choose how you want to feel.{"\n"}We’ll find what to watch.
            </Text>
            <TouchableOpacity
              style={styles.obBtn}
              onPress={dismissOnboarding}
              activeOpacity={0.82}
            >
              <Text style={styles.obBtnText}>Got it  →</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Welcome overlay (fresh login only) ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.welcomeOverlay,
          { opacity: welcomeAnim },
        ]}
      >
        <Animated.Text style={[styles.welcomeIcon, { transform: [{ scale: logoScale }] }]}>
          ◈
        </Animated.Text>
        <Text style={styles.welcomeGreeting}>{getGreeting().headline}</Text>
        {userName ? (
          <Text style={styles.welcomeName}>{getGreeting().subline(userName)}</Text>
        ) : null}
      </Animated.View>
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

  // Subtle adaptive glow — 8% opacity, lives behind all content
  adaptiveGlow: {
    opacity: 0.08,
    top: 0,
    height: 320,
    bottom: undefined,
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

  welcomeOverlay: {
    backgroundColor: "#0A0A0C",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  // ── Onboarding overlay ────────────────────────────────────────────
  onboardingBackdrop: {
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  onboardingCard: {
    backgroundColor: "#141418",
    borderRadius: 24,
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 32,
    alignItems: "center",
    gap: 14,
    maxWidth: 360,
    width: "100%",
  },
  obIcon: {
    fontSize: 44,
    color: "#8B1A2E",
    marginBottom: 4,
    lineHeight: 52,
  },
  obHeadline: {
    fontFamily: Typography.display,
    fontSize: 26,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  obBody: {
    fontFamily: Typography.sans,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: "center",
  },
  obBtn: {
    marginTop: 8,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 32,
    backgroundColor: "#8B1A2E",
  },
  obBtnText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.2,
  },

  welcomeGreeting: {
    fontFamily: Typography.display,
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  welcomeName: {
    fontFamily: Typography.sans,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  welcomeIcon: {
    fontSize: 52,
    color: "#8B1A2E",
    marginBottom: 12,
    lineHeight: 60,
  },
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

// ─── Session banner styles ────────────────────────────────────────────────────
const sbStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radii.md,
    borderWidth: 0.6,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceRaised,
  },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { fontSize: 22 },
  textCol: { flex: 1, gap: 5 },
  label: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: {
    width: 44,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 2.5, borderRadius: 2 },
  itemName: {
    flex: 1,
    fontFamily: Typography.sans,
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
  dismiss: { paddingLeft: 12 },
  dismissText: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
