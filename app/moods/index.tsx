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
import { useAuthStore } from "@/lib/store/authStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const CARD_W = Math.floor((width - Spacing.screen * 2 - Spacing.sm) / 2);
const BG = "#0A0A0C";
const TEXT3 = "rgba(255,255,255,0.28)";

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
  const { userName, userId } = useAuthStore();
  const { prefs, loadPrefs } = useSettingsStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (userId) loadPrefs(userId); }, [userId]);

  const initial = userName?.[0]?.toUpperCase() ?? "?";
  const AVATAR_PALETTE = ["#8B1A2E","#4A90C4","#9B7FD4","#2AB09A","#E07030","#C05080"];
  const avatarBg = (() => {
    if (!userId) return AVATAR_PALETTE[0];
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
  })();

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
      {/* Warm shimmer background */}
      <LinearGradient
        colors={["rgba(255,230,140,0.05)", "rgba(230,110,90,0.025)", "transparent"]}
        locations={[0, 0.4, 0.8]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.45 }}
        pointerEvents="none"
      />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>All Moods</Text>
          <LinearGradient colors={[avatarBg, "#7A1525"]} style={styles.avatarBubble}>
            {prefs.avatarEmoji
              ? <Text style={styles.avatarEmoji}>{prefs.avatarEmoji}</Text>
              : <Text style={styles.avatarLetter}>{initial}</Text>
            }
          </LinearGradient>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Recently Used */}
          {recentMoods.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RECENTLY USED</Text>
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
              <Text style={styles.sectionLabel}>{cat.label.toUpperCase()}</Text>
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
  safe: { flex: 1, backgroundColor: BG },
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
    color: "rgba(255,255,255,0.5)",
  },
  title: {
    flex: 1,
    fontFamily: Typography.displayBold,
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  avatarBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 15,
    color: "#fff",
  },
  avatarEmoji: {
    fontSize: 18,
  },
  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 80,
    gap: Spacing.xl,
  },
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 10.5,
    color: TEXT3,
    textTransform: "uppercase",
    letterSpacing: 1.5,
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
    borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  gradient: {
    padding: Spacing.md,
    minHeight: 126,
    justifyContent: "space-between",
  },
  glow: {
    position: "absolute",
    top: -18,
    left: -18,
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.5,
  },
  icon: { fontSize: 24, lineHeight: 28 },
  label: {
    fontFamily: Typography.display,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: -0.25,
  },
  tagline: {
    fontFamily: Typography.sans,
    fontSize: 11,
    lineHeight: 15,
  },
});
