import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/store/authStore";
import { useSessionStore } from "@/lib/store/sessionStore";
import { useFeedbackStore } from "@/lib/store/feedbackStore";
import { useOnboardingStore } from "@/lib/store/onboardingStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

// ─── Derive a consistent avatar color from userId ─────────────────────────────
const AVATAR_PALETTE = [
  "#8B1A2E", "#4A90C4", "#9B7FD4",
  "#2AB09A", "#E07030", "#C05080",
];
function avatarColor(userId: string | null): string {
  if (!userId) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// ─── Reusable section header ──────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Reusable settings row ────────────────────────────────────────────────────
interface RowProps {
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  disclosure?: boolean;
  value?: string;
}
function Row({ label, subtitle, onPress, destructive = false, disclosure = false, value }: RowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
          {label}
        </Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {disclosure ? <Text style={styles.rowChevron}>›</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <View style={styles.divider} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const { userName, userId, serverUrl, logout } = useAuthStore();
  const { clearRecentMoods } = useSessionStore();
  const { clearFeedback } = useFeedbackStore();
  const { resetOnboarding } = useOnboardingStore();
  const { prefs, loadPrefs, updatePrefs } = useSettingsStore();

  useEffect(() => {
    if (userId) loadPrefs(userId);
  }, [userId]);

  const color = avatarColor(userId);
  const initial = userName?.[0]?.toUpperCase() ?? "?";

  // ─── Runtime options ───────────────────────────
  const RUNTIME_OPTIONS: { label: string; value: number | null }[] = [
    { label: "No limit", value: null },
    { label: "45 min", value: 45 },
    { label: "90 min", value: 90 },
    { label: "2 hours", value: 120 },
    { label: "2.5 hours", value: 150 },
  ];
  const currentRuntimeIdx = RUNTIME_OPTIONS.findIndex(
    (o) => o.value === prefs.maxRuntimeMinutes
  );
  const cycleRuntime = () => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = RUNTIME_OPTIONS[(currentRuntimeIdx + 1) % RUNTIME_OPTIONS.length];
    updatePrefs(userId, { maxRuntimeMinutes: next.value });
  };

  // ─── Sensitivity toggle ────────────────────────
  const toggleSensitivity = () => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePrefs(userId, {
      feedbackSensitivity: prefs.feedbackSensitivity === "strict" ? "relaxed" : "strict",
    });
  };

  const handleClearFeedback = () => {
    Alert.alert(
      "Clear watch feedback?",
      "All your ratings and skipped markers will be removed. Your mood suggestions will start fresh.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await clearFeedback();
          },
        },
      ]
    );
  };

  const handleClearMoods = () => {
    Alert.alert(
      "Clear mood history?",
      "Your recently used moods list will be reset.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await clearRecentMoods();
          },
        },
      ]
    );
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      "Reset intro?",
      "The welcome tip will appear again on your next visit to the home screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await resetOnboarding();
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You'll need to sign in again to access Pomflix.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            logout();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ─── Nav bar ─── */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Profile card ─── */}
        <View style={styles.profileCard}>
          <View style={[styles.avatarLg, { backgroundColor: color }]}>
            <Text style={styles.avatarLgText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName ?? "Unknown"}</Text>
            <Text style={styles.profileSub}>Pomflix Member</Text>
          </View>
        </View>

        {/* ─── Preferences ─── */}
        <View style={styles.section}>
          <SectionHeader title="Preferences" />
          <View style={styles.card}>
            <Row
              label="Max runtime"
              subtitle="Limits how long suggested content can be"
              value={RUNTIME_OPTIONS[currentRuntimeIdx]?.label ?? "No limit"}
              onPress={cycleRuntime}
            />
            <Divider />
            <Row
              label="Suggestion sensitivity"
              subtitle={prefs.feedbackSensitivity === "strict"
                ? "Skipped titles are hidden from suggestions"
                : "Skipped titles are shown but ranked lower"}
              value={prefs.feedbackSensitivity === "strict" ? "Strict" : "Relaxed"}
              onPress={toggleSensitivity}
            />
            <Divider />
            <Row
              label="Pinned & hidden moods"
              subtitle={
                prefs.pinnedMoodIds.length > 0
                  ? `${prefs.pinnedMoodIds.length} pinned · ${prefs.hiddenMoodIds.length} hidden`
                  : "Customise which moods appear on home"
              }
              onPress={() => router.push("/settings/moods")}
              disclosure
            />
          </View>
        </View>

        {/* ─── Your Data ─── */}
        <View style={styles.section}>
          <SectionHeader title="Your Data" />
          <View style={styles.card}>
            <Row
              label="Clear watch feedback"
              subtitle="Removes all ratings and skipped markers"
              onPress={handleClearFeedback}
              destructive
            />
            <Divider />
            <Row
              label="Clear mood history"
              subtitle="Resets your recently used moods"
              onPress={handleClearMoods}
              destructive
            />
            <Divider />
            <Row
              label="Reset intro tip"
              subtitle="Show the welcome card again"
              onPress={handleResetOnboarding}
            />
          </View>
        </View>

        {/* ─── Account ─── */}
        <View style={styles.section}>
          <SectionHeader title="Account" />
          <View style={styles.card}>
            <Row
              label="Server"
              value={serverUrl?.replace(/^https?:\/\//, "") ?? "—"}
              onPress={() => {}}
            />
            <Divider />
            <Row
              label="Sign Out"
              onPress={handleSignOut}
              destructive
            />
          </View>
        </View>

        {/* ─── Footer ─── */}
        <Text style={styles.footer}>Pomflix · Made with ◈</Text>
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
    paddingBottom: Spacing.md,
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

  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 60,
    gap: Spacing.xl,
  },

  // ── Profile card ──────────────────────────────────────────────────
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLgText: {
    fontFamily: Typography.displayBold,
    fontSize: 22,
    color: "#fff",
  },
  profileInfo: { gap: 4 },
  profileName: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  profileSub: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // ── Sections ──────────────────────────────────────────────────────
  section: { gap: Spacing.sm },
  sectionHeader: {
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

  // ── Row ───────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 54,
  },
  rowLeft: { flex: 1, gap: 3 },
  rowLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  rowLabelDestructive: { color: "#E05050" },
  rowSubtitle: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: Spacing.sm,
    maxWidth: 160,
  },
  rowValue: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "right",
    flexShrink: 1,
  },
  rowChevron: {
    fontSize: 20,
    color: Colors.textMuted,
    lineHeight: 22,
  },

  divider: {
    height: 0.5,
    backgroundColor: Colors.surfaceBorder,
    marginLeft: Spacing.md,
  },

  // ── Footer ───────────────────────────────────────────────────────
  footer: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    paddingTop: Spacing.sm,
  },
});
