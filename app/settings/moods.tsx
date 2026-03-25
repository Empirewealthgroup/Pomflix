import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import * as Haptics from "expo-haptics";
import { MOOD_CATEGORIES } from "@/constants/modes";
import type { ModeId, Mode } from "@/constants/modes";
import { useAuthStore } from "@/lib/store/authStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

export default function MoodPreferencesScreen() {
  const router = useRouter();
  const { userId } = useAuthStore();
  const { prefs, loadPrefs, togglePinnedMood, toggleHiddenMood } = useSettingsStore();

  useEffect(() => {
    if (userId) loadPrefs(userId);
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
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Moods</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.brand }]} />
          <Text style={styles.legendText}>Pinned — shown on home (max 3)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.textMuted }]} />
          <Text style={styles.legendText}>Hidden — removed from suggestions</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {MOOD_CATEGORIES.map((cat) => (
          <View key={cat.id} style={styles.section}>
            <Text style={styles.sectionLabel}>{cat.label}</Text>
            <View style={styles.card}>
              {cat.moods.map((mood, idx) => {
                const isPinned = prefs.pinnedMoodIds.includes(mood.id);
                const isHidden = prefs.hiddenMoodIds.includes(mood.id);
                const isLast = idx === cat.moods.length - 1;

                return (
                  <View key={mood.id}>
                    <View style={styles.row}>
                      {/* Mood identity */}
                      <View style={styles.moodId}>
                        <Text style={[styles.moodIcon, { color: mood.colors.accent }]}>
                          {mood.icon}
                        </Text>
                        <View>
                          <Text style={[styles.moodLabel, isHidden && styles.moodLabelDimmed]}>
                            {mood.label}
                          </Text>
                          <Text style={styles.moodTagline} numberOfLines={1}>
                            {mood.tagline}
                          </Text>
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={styles.actions}>
                        {/* Pin toggle */}
                        <TouchableOpacity
                          onPress={() => handleTogglePin(mood)}
                          style={[styles.chip, isPinned && { backgroundColor: `${Colors.brand}33`, borderColor: Colors.brand }]}
                          activeOpacity={0.75}
                          disabled={isHidden}
                        >
                          <Text style={[styles.chipText, isPinned && { color: Colors.brand }]}>
                            {isPinned ? "★ Pinned" : "☆ Pin"}
                          </Text>
                        </TouchableOpacity>

                        {/* Hide toggle */}
                        <TouchableOpacity
                          onPress={() => handleToggleHide(mood)}
                          style={[styles.chip, isHidden && { backgroundColor: "rgba(255,255,255,0.06)", borderColor: Colors.textMuted }]}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.chipText, isHidden && { color: Colors.textSecondary }]}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  back: { width: 60 },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  navTitle: {
    flex: 1,
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.4,
  },

  legend: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.sm,
    gap: 6,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textMuted,
  },

  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 60,
    gap: Spacing.lg,
  },

  section: { gap: Spacing.sm },
  sectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },

  moodId: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  moodIcon: { fontSize: 18, width: 22, textAlign: "center" },
  moodLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  moodLabelDimmed: { color: Colors.textMuted },
  moodTagline: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },

  actions: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "transparent",
  },
  chipText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.textMuted,
  },

  divider: {
    height: 0.5,
    backgroundColor: Colors.surfaceBorder,
    marginLeft: Spacing.md,
  },

  hint: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    paddingTop: Spacing.sm,
  },
});
