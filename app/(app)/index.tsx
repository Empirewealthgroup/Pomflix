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
import { MODES, getModeById, type ModeId } from "@/constants/modes";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import ModeCard from "@/components/ModeCard";
import { SkeletonRow } from "@/components/SkeletonCard";
import { useSettingsStore } from "@/lib/store/settingsStore";
import type { JellyfinItem } from "@/lib/jellyfin/types";

// ─── Session-persisted last-used mode ────────────────────────────────────────
let _lastUsedModeId: string | null = null;

// ─── Avatar color derived from userId ────────────────────────────────────────
const AVATAR_PALETTE = ["#8B1A2E", "#4A90C4", "#9B7FD4", "#2AB09A", "#E07030", "#C05080"];
function avatarColor(userId: string | null): string {
  if (!userId) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// ─── Contextual greeting ──────────────────────────────────────────────────────
function getGreeting(): { headline: string; subline: (n: string) => string } {
  const h = new Date().getHours();
  if (h < 5)  return { headline: "Still up?",            subline: (n) => `Night owl mode, ${n}.` };
  if (h < 9)  return { headline: "Ease into your day.",  subline: (n) => `Good morning, ${n}.` };
  if (h < 12) return { headline: "Good morning.",        subline: (n) => `How are we feeling, ${n}?` };
  if (h < 14) return { headline: "Midday break?",        subline: (n) => `Take a moment, ${n}.` };
  if (h < 17) return { headline: "Good afternoon.",      subline: (n) => `What's on your mind, ${n}?` };
  if (h < 21) return { headline: "Good evening.",        subline: (n) => `What's the mood, ${n}?` };
  if (h < 23) return { headline: "Winding down.",        subline: (n) => `One more, ${n}?` };
  return      { headline: "Late night.",                 subline: (n) => `Still here, ${n}.` };
}
// ─── Time-aware session banner copy ──────────────────────────────────────────
function getSessionBannerCopy(modeLabel: string, elapsedLabel: string): string {
  const h = new Date().getHours();
  if (h < 5)  return `Still up? Let’s finish this  ·  ${elapsedLabel}`;
  if (h < 12) return `Good morning — continue your ${modeLabel}  ·  ${elapsedLabel}`;
  if (h < 17) return `Good time for a break  ·  ${elapsedLabel}`;
  if (h < 21) return `Continue your ${modeLabel}  ·  ${elapsedLabel}`;
  return `One more before sleep? ${modeLabel}  ·  ${elapsedLabel}`;
}
// ─── Adaptive time-of-day mood recommendations ───────────────────────────────
type TimeMoods = { glowColor: string; heroMoodId: ModeId; supportMoodIds: ModeId[] };
function getTimeMoods(): TimeMoods {
  const h = new Date().getHours();
  if (h >= 5 && h < 11)
    return { glowColor: "#4A90C4", heroMoodId: "focus", supportMoodIds: ["deep_work", "locked_in", "explore"] };
  if (h >= 11 && h < 17)
    return { glowColor: "#E07030", heroMoodId: "locked_in", supportMoodIds: ["focus", "laugh", "explore"] };
  if (h >= 17 && h < 22)
    return { glowColor: "#9B7FD4", heroMoodId: "wind_down", supportMoodIds: ["calm", "intimate", "escape"] };
  return { glowColor: "#4A6FA0", heroMoodId: "drift", supportMoodIds: ["calm", "reflect", "wind_down"] };
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
  const timeLeft = (() => {
    if (!item.RunTimeTicks || progress <= 0) return null;
    const remaining = Math.round((item.RunTimeTicks / 600_000_000) * (1 - progress / 100));
    return remaining > 0 ? remaining : null;
  })();

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
          colors={["transparent", "rgba(5,5,7,0.98)"]}
          style={cwStyles.overlay}
        >
          <Text style={cwStyles.title} numberOfLines={1}>{item.Name}</Text>
          {timeLeft !== null && (
            <Text style={cwStyles.timeLeft}>{timeLeft} min left</Text>
          )}
          {progress > 0 && (
            <View style={cwStyles.progressRow}>
              <View style={cwStyles.progressTrack}>
                <View style={[cwStyles.progressFill, { width: `${progress}%` as any }]} />
              </View>
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
  const bannerCopy = getSessionBannerCopy(session.modeLabel, elapsedLabel);
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
            {bannerCopy}
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
  const { serverUrl, token, userId, userName, isNewLogin, clearNewLogin } = useAuthStore();
  const { currentSession, clearSession, loadStoredSession } = useSessionStore();
  const { hasSeen, markSeen, loadOnboarding } = useOnboardingStore();
  const { prefs, loadPrefs } = useSettingsStore();
  const [continueItems, setContinueItems] = useState<JellyfinItem[]>([]);
  const [loadingContinue, setLoadingContinue] = useState(true);
  const [continueError, setContinueError] = useState(false);
  const [lastUsedModeId, setLastUsedModeId] = useState<string | null>(_lastUsedModeId);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Mood layout: pinned overrides time-based hero/support
  const timeMoods = getTimeMoods();
  const visibleModes = MODES.filter((m) => !prefs.hiddenMoodIds.includes(m.id));
  const glowColor = (() => {
    if (prefs.pinnedMoodIds.length > 0) {
      const pinned = getModeById(prefs.pinnedMoodIds[0]);
      return pinned ? pinned.colors.base : timeMoods.glowColor;
    }
    return timeMoods.glowColor;
  })();
  const heroMood = (() => {
    if (prefs.pinnedMoodIds.length > 0) {
      const pinned = visibleModes.find((m) => m.id === prefs.pinnedMoodIds[0]);
      if (pinned) return pinned;
    }
    return visibleModes.find((m) => m.id === timeMoods.heroMoodId) ?? visibleModes[0];
  })();
  const supportMoods = (() => {
    if (prefs.pinnedMoodIds.length > 1) {
      // Use remaining pinned moods as support, fill up to 3 with time-based
      const pinnedSupport = prefs.pinnedMoodIds
        .slice(1)
        .map((id) => visibleModes.find((m) => m.id === id))
        .filter(Boolean) as typeof MODES;
      const timeFill = timeMoods.supportMoodIds
        .map((id) => getModeById(id))
        .filter((m) => m && !prefs.pinnedMoodIds.includes(m.id) && !prefs.hiddenMoodIds.includes(m.id)) as typeof MODES;
      return [...pinnedSupport, ...timeFill].slice(0, 3);
    }
    return timeMoods.supportMoodIds
      .map((id) => getModeById(id))
      .filter((m) => m && !prefs.hiddenMoodIds.includes(m.id)) as typeof MODES;
  })();

  // Color-morph transition overlay
  const [overlayColor, setOverlayColor] = useState("#000");
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Welcome overlay (fresh login only)
  const welcomeAnim = useRef(new Animated.Value(isNewLogin ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(isNewLogin ? 0.7 : 1)).current;

  // Onboarding overlay
  const onboardingSlideAnim = useRef(new Animated.Value(60)).current;
  const onboardingFadeAnim = useRef(new Animated.Value(0)).current;

  // Living background pulse — two offset loops
  const glowPulse1 = useRef(new Animated.Value(0)).current;
  const glowPulse2 = useRef(new Animated.Value(0)).current;

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
  useEffect(() => { if (userId) loadPrefs(userId); }, [userId]);

  useEffect(() => {
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse1, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(glowPulse1, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    anim1.start();
    let anim2: ReturnType<typeof Animated.loop> | null = null;
    const t = setTimeout(() => {
      anim2 = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse2, { toValue: 1, duration: 1700, useNativeDriver: true }),
          Animated.timing(glowPulse2, { toValue: 0, duration: 1700, useNativeDriver: true }),
        ])
      );
      anim2.start();
    }, 1100);
    return () => { clearTimeout(t); anim1.stop(); anim2?.stop(); };
  }, []);

  useEffect(() => {
    if (!serverUrl || !token || !userId) return;
    setLoadingContinue(true);
    setContinueError(false);
    getContinueWatching(serverUrl, token, userId, 8)
      .then(setContinueItems)
      .catch(() => setContinueError(true))
      .finally(() => setLoadingContinue(false));
  }, [serverUrl, token, userId]);

  const { headline, subline } = getGreeting();

  const handleQuickPlay = (modeId: string) => {
    _lastUsedModeId = modeId;
    setLastUsedModeId(modeId);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ─── Living background glow ─── */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.adaptiveGlow,
          {
            backgroundColor: glowColor,
            opacity: glowPulse1.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.16] }),
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.adaptiveGlowSecondary,
          {
            backgroundColor: glowColor,
            opacity: glowPulse2.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.09] }),
          },
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
              router.push("/settings");
            }}
            style={styles.avatarBtn}
            hitSlop={8}
          >
            <View style={[styles.avatar, { backgroundColor: avatarColor(userId) }]}>
              <Text style={styles.avatarText}>{userName?.[0]?.toUpperCase() ?? "?"}</Text>
            </View>
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
          <View style={styles.moodGrid}>
            {/* Hero mood — full width */}
            <ModeCard
              mode={heroMood}
              isRecommended
              size="hero"
              enterDelay={200}
              onQuickPlay={handleQuickPlay}
              onTransition={handleModeTransition}
            />
            {/* Support moods — 3-column compact row */}
            <View style={styles.supportRow}>
              {supportMoods.map((mode, index) => (
                <ModeCard
                  key={mode.id}
                  mode={mode}
                  isRecent={mode.id === lastUsedModeId}
                  size="compact"
                  enterDelay={300 + index * 60}
                  onQuickPlay={handleQuickPlay}
                  onTransition={handleModeTransition}
                />
              ))}
            </View>
            {/* View all moods */}
            <TouchableOpacity
              onPress={() => router.push("/moods")}
              style={styles.viewAllLink}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View all moods →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── Continue Watching ──────────────────────────────────────── */}
        {(loadingContinue || continueItems.length > 0 || continueError) && (
          <Animated.View style={[styles.section, { opacity: sectionAnim }]}>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
            {loadingContinue ? (
              <SkeletonRow count={3} size="medium" />
            ) : continueError ? (
              <TouchableOpacity
                onPress={() => {
                  setContinueError(false);
                  setLoadingContinue(true);
                  getContinueWatching(serverUrl!, token!, userId!, 8)
                    .then(setContinueItems)
                    .catch(() => setContinueError(true))
                    .finally(() => setLoadingContinue(false));
                }}
                style={{ paddingVertical: 12 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.sectionTitle, { fontSize: 13, color: Colors.textMuted }]}>
                  Could not load — tap to retry
                </Text>
              </TouchableOpacity>
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

  // Primary living glow — opacity driven by glowPulse1 via inline style
  adaptiveGlow: {
    top: 0,
    height: 420,
    bottom: undefined,
  },
  // Secondary radial blob — offset position + timing
  adaptiveGlowSecondary: {
    position: "absolute",
    top: 200,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
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
  avatarBtn: { paddingBottom: 2, paddingLeft: 12 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 14,
    color: "#fff",
  },

  section: { gap: Spacing.md },
  sectionTitle: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  moodGrid: {
    gap: Spacing.sm,
  },
  supportRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  viewAllLink: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  viewAllText: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.3,
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
    height: 260,
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
    height: 110,
    justifyContent: "flex-end",
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 4,
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
    height: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.brand,
    borderRadius: 2,
  },
  timeLeft: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 14,
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
