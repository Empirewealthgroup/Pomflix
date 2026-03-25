import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import { MODES, MOOD_CATEGORIES } from "@/constants/modes";
import type { Mode } from "@/constants/modes";
import { useSessionStore } from "@/lib/store/sessionStore";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const CARD_W = Math.floor((width - Spacing.screen * 2 - Spacing.sm) / 2);

// ── Individual mood card ──────────────────────────────────────────────────────
function MoodRow({ mode, onPress }: { mode: Mode; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[mStyles.card, { width: CARD_W, transform: [{ scale }] }]}>
        <LinearGradient
          colors={[`${mode.colors.base}EE`, `${mode.colors.base}55`, Colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={mStyles.gradient}
        >
          <View style={[mStyles.glow, { backgroundColor: mode.colors.glow }]} pointerEvents="none" />
          <Text style={[mStyles.icon, { color: mode.colors.accent }]}>{mode.icon}</Text>
          <Text style={mStyles.label}>{mode.label}</Text>
          <Text style={[mStyles.tagline, { color: mode.colors.textAccent }]} numberOfLines={1}>
            {mode.tagline}
          </Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function MoodsScreen() {
  const router = useRouter();
  const { recentMoodIds } = useSessionStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  const recentMoods = recentMoodIds
    .map((id) => MODES.find((m) => m.id === id))
    .filter(Boolean) as Mode[];

  const handlePress = (mode: Mode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/mode/${mode.id}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>All Moods</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Recently Used */}
          {recentMoods.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Recently Used</Text>
              <View style={styles.grid}>
                {recentMoods.slice(0, 4).map((mode) => (
                  <MoodRow key={mode.id} mode={mode} onPress={() => handlePress(mode)} />
                ))}
              </View>
            </View>
          )}

          {/* Grouped by category */}
          {MOOD_CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.section}>
              <Text style={styles.sectionLabel}>{cat.label}</Text>
              <View style={styles.grid}>
                {cat.moods.map((mode) => (
                  <MoodRow key={mode.id} mode={mode} onPress={() => handlePress(mode)} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  back: { width: 60 },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  title: {
    flex: 1,
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 80,
    gap: Spacing.xl,
  },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
});

const mStyles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  gradient: {
    padding: Spacing.md,
    minHeight: 120,
    justifyContent: "space-between",
  },
  glow: {
    position: "absolute",
    top: -16,
    left: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    opacity: 0.55,
  },
  icon: { fontSize: 22, lineHeight: 26 },
  label: {
    fontFamily: Typography.display,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  tagline: {
    fontFamily: Typography.sans,
    fontSize: 11,
    lineHeight: 15,
  },
});
