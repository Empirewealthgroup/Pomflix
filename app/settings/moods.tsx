import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { MOOD_CATEGORIES } from "@/constants/modes";
import type { ModeId, Mode } from "@/constants/modes";
import { useAuthStore } from "@/lib/store/authStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

const BG = "#0A0A0C";
const CARD = "#141416";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT = "#F2EDE8";
const TEXT2 = "rgba(255,255,255,0.5)";
const TEXT3 = "rgba(255,255,255,0.28)";

export default function MoodPreferencesScreen() {
  const router = useRouter();
  const { userId } = useAuthStore();
  const { prefs, loadPrefs, togglePinnedMood, toggleHiddenMood } = useSettingsStore();

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (userId) loadPrefs(userId);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 14, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [userId]);

  const handleTogglePin = (mood: Mode) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    togglePinnedMood(userId, mood.id);
  };

  const handleToggleHide = (mood: Mode) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleHiddenMood(userId, mood.id);
  };

  return (
    <View style={styles.root}>
      {/* Warm shimmer bg */}
      <LinearGradient
        colors={["rgba(255,230,140,0.04)", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 0.4 }}
        pointerEvents="none"
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <Animated.View style={[styles.headerWrap, { opacity: fadeAnim }]}>
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>Moods</Text>
            <View style={{ width: 60 }} />
          </View>
          <Text style={styles.subtitle}>
            Pin up to 3 moods for quick access. Hidden moods won’t appear in suggestions.
          </Text>
        </Animated.View>

        <Animated.ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {MOOD_CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.section}>
              <Text style={styles.sectionLabel}>{cat.label.toUpperCase()}</Text>
              <View style={styles.card}>
                {cat.moods.map((mood, idx) => {
                  const isPinned = prefs.pinnedMoodIds.includes(mood.id);
                  const isHidden = prefs.hiddenMoodIds.includes(mood.id);
                  const isLast = idx === cat.moods.length - 1;

                  return (
                    <View key={mood.id}>
                      <View style={styles.row}>
                        {/* Mood identity */}
                        <View style={[styles.moodIconWrap, { backgroundColor: `${mood.colors.accent}18` }]}>
                          <Text style={[styles.moodIcon, { color: mood.colors.accent }]}>
                            {mood.icon}
                          </Text>
                        </View>
                        <View style={styles.moodId}>
                          <Text style={[styles.moodLabel, isHidden && styles.moodLabelDimmed]}>
                            {mood.label}
                          </Text>
                          <Text style={styles.moodTagline} numberOfLines={1}>
                            {mood.tagline}
                          </Text>
                        </View>

                        {/* Actions */}
                        <View style={styles.actions}>
                          {/* Pin toggle */}
                          <TouchableOpacity
                            onPress={() => handleTogglePin(mood)}
                            style={[
                              styles.chip,
                              isPinned && styles.chipPinned,
                              isHidden && styles.chipDisabled,
                            ]}
                            activeOpacity={0.75}
                            disabled={isHidden}
                          >
                            <Text style={[
                              styles.chipText,
                              isPinned && styles.chipTextPinned,
                              isHidden && styles.chipTextDisabled,
                            ]}>
                              {isPinned ? "★ Pinned" : "☆ Pin"}
                            </Text>
                          </TouchableOpacity>

                          {/* Hide toggle */}
                          <TouchableOpacity
                            onPress={() => handleToggleHide(mood)}
                            style={[styles.chip, isHidden && styles.chipHidden]}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.chipText, isHidden && styles.chipTextHidden]}>
                              {isHidden ? "● Hidden" : "○ Hide"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {!isLast && <View style={styles.divider} />}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          <Text style={styles.hint}>
            Pinned moods override the time-based home recommendation.{"\n"}
            Hidden moods won't appear in suggestions or View All.
          </Text>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  headerWrap: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.sm,
    gap: 6,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  back: { width: 60 },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: TEXT2,
  },
  navTitle: {
    flex: 1,
    fontFamily: Typography.displayBold,
    fontSize: 22,
    color: TEXT,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: TEXT3,
    lineHeight: 19,
    paddingHorizontal: 4,
  },

  content: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: 60,
    gap: Spacing.xl,
  },

  section: { gap: Spacing.sm },
  sectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 10.5,
    color: TEXT3,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: Radii.lg,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: Spacing.sm,
  },

  moodIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  moodIcon: { fontSize: 16 },

  moodId: { flex: 1, gap: 2 },
  moodLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: TEXT,
  },
  moodLabelDimmed: { color: TEXT3 },
  moodTagline: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: TEXT2,
    marginTop: 1,
  },

  actions: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "transparent",
  },
  chipPinned: {
    backgroundColor: "rgba(139,26,46,0.22)",
    borderColor: "rgba(139,26,46,0.5)",
  },
  chipHidden: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  chipDisabled: {
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "transparent",
  },
  chipText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: TEXT3,
  },
  chipTextPinned: { color: "#D45A72" },
  chipTextHidden: { color: TEXT2 },
  chipTextDisabled: { color: "rgba(255,255,255,0.14)" },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: Spacing.md,
  },

  hint: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: TEXT3,
    textAlign: "center",
    lineHeight: 18,
    paddingTop: Spacing.sm,
  },
});
