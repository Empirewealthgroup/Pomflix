import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Animated,
  Pressable,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/store/authStore";
import { useSessionStore } from "@/lib/store/sessionStore";
import { useFeedbackStore } from "@/lib/store/feedbackStore";
import { useOnboardingStore } from "@/lib/store/onboardingStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useNowPlayingStore } from "@/lib/store/nowPlayingStore";
import { Typography } from "@/constants/theme";

// --- Design tokens -----------------------------------------------------------
const BG         = "#0A0A0C";
const BG2        = "#0E0E11";
const CARD       = "#141416";
const BORDER     = "rgba(255,255,255,0.06)";
const TEXT       = "#F2EDE8";
const TEXT2      = "rgba(255,255,255,0.5)";
const TEXT3      = "rgba(255,255,255,0.28)";
const RED        = "#A32035";
const RED_LIGHT  = "#FF5A5F";
const { height: SCREEN_H } = Dimensions.get("window");

// --- Avatar ------------------------------------------------------------------
const AVATAR_PALETTE = ["#8B1A2E","#4A90C4","#9B7FD4","#2AB09A","#E07030","#C05080"];
function avatarColor(userId: string | null): string {
  if (!userId) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// --- Picker sheet ------------------------------------------------------------
interface PickerOption<T> { label: string; value: T }
interface PickerSheetProps<T> {
  visible: boolean;
  title: string;
  options: PickerOption<T>[];
  current: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}
function PickerSheet<T>({ visible, title, options, current, onSelect, onClose }: PickerSheetProps<T>) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 18, tension: 140, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[ps.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[ps.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }]}>
        <View style={ps.handle} />
        <Text style={ps.sheetTitle}>{title}</Text>
        {options.map((opt, i) => {
          const isSelected = opt.value === current;
          return (
            <TouchableOpacity
              key={i}
              style={[ps.option, isSelected && ps.optionActive]}
              activeOpacity={0.75}
              onPress={() => { onSelect(opt.value); onClose(); }}
            >
              <Text style={[ps.optionLabel, isSelected && ps.optionLabelActive]}>
                {opt.label}
              </Text>
              {isSelected && <Text style={ps.optionCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

// --- ProfileSheet -----------------------------------------------------------
interface ProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  userName: string | null;
  userId: string | null;
  serverUrl: string | null;
  avatarColor: string;
  avatarInitial: string;
  nowPlaying: string | null;
}
function ProfileSheet({ visible, onClose, userName, userId, serverUrl, avatarColor: aColor, avatarInitial, nowPlaying }: ProfileSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 16, tension: 120, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 240, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const serverDisplay = serverUrl?.replace(/^https?:\/\//, "") ?? "—";
  const idShort = userId ? `···${userId.slice(-8)}` : "—";

  const rows: { icon: string; label: string; value: string }[] = [
    { icon: "✦", label: "Display name", value: userName ?? "Unknown" },
    { icon: "◎", label: "Server", value: serverDisplay },
    { icon: "#", label: "User ID", value: idShort },
    { icon: "◈", label: "Account type", value: "Standard member" },
    { icon: "▶", label: "Now playing", value: nowPlaying ?? "Nothing playing" },
  ];

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[pf.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[pf.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 24 }]}>
        <View style={pf.handle} />

        {/* Avatar + name hero */}
        <View style={pf.hero}>
          <LinearGradient
            colors={["rgba(255,230,140,0.18)", "rgba(230,110,90,0.08)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: 80 }]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }}
            pointerEvents="none"
          />
          <LinearGradient colors={[aColor, RED]} style={pf.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <LinearGradient
              colors={["transparent", "rgba(255,248,200,0.0)", "rgba(255,248,200,0.26)", "rgba(255,255,240,0.05)", "transparent"]}
              style={pf.avatarFlare}
              start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
              pointerEvents="none"
            />
            <Text style={pf.avatarLetter}>{avatarInitial}</Text>
          </LinearGradient>
          <View style={pf.heroText}>
            <Text style={pf.heroName}>{userName ?? "Unknown"}</Text>
            <Text style={pf.heroSub}>Your profile</Text>
          </View>
        </View>

        {/* Info rows */}
        {rows.map((r, i) => (
          <View key={i} style={[pf.row, i < rows.length - 1 && pf.rowBorder]}>
            <Text style={pf.rowIcon}>{r.icon}</Text>
            <View style={pf.rowBody}>
              <Text style={pf.rowLabel}>{r.label}</Text>
              <Text style={pf.rowValue} numberOfLines={1}>{r.value}</Text>
            </View>
          </View>
        ))}
      </Animated.View>
    </Modal>
  );
}

const pf = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#16161A",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: BORDER,
    paddingTop: 12,
    zIndex: 11,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 20,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 22,
    paddingBottom: 20,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    overflow: "hidden",
  },
  avatar: {
    width: 54, height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarFlare: {
    position: "absolute",
    width: 90, height: 90,
    top: -18, left: -18,
  },
  avatarLetter: {
    fontFamily: Typography.displayBold,
    fontSize: 20,
    color: "#fff",
  },
  heroText: { gap: 3 },
  heroName: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: TEXT,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: TEXT2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  rowIcon: {
    width: 22,
    textAlign: "center",
    fontSize: 13,
    color: TEXT3,
  },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: TEXT3,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  rowValue: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.1,
  },
});

// --- SettingsRow -------------------------------------------------------------
interface RowProps {
  title: string;
  subtitle?: string;
  value?: string;
  destructive?: boolean;
  chevron?: boolean;
  onPress: () => void;
}
function SettingsRow({ title, subtitle, value, destructive, chevron, onPress }: RowProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.985, friction: 10, tension: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 10, tension: 200, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <Animated.View style={[row.wrap, { transform: [{ scale }] }]}>
        <View style={row.left}>
          <Text style={[row.title, destructive && row.titleDestructive]}>{title}</Text>
          {subtitle ? <Text style={row.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={row.right}>
          {value ? <Text style={row.value}>{value}</Text> : null}
          {chevron ? <Text style={row.chevron}>›</Text> : null}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// --- SettingsCard ------------------------------------------------------------
function SettingsCard({ children, accentColor }: { children: React.ReactNode; accentColor?: string }) {
  return (
    <View style={card.wrap}>
      {/* top-edge warm shimmer — yellow-white, hint of rose */}
      <LinearGradient
        colors={["rgba(255,230,140,0.10)", "rgba(230,110,90,0.05)", "transparent"]}
        style={[StyleSheet.absoluteFill, { height: 80 }]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

// --- Section -----------------------------------------------------------------
function Section({ title, children, accentColor }: { title: string; children: React.ReactNode; accentColor?: string }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.label}>{title}</Text>
      <SettingsCard accentColor={accentColor}>{children}</SettingsCard>
    </View>
  );
}

// --- Divider -----------------------------------------------------------------
function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 18 }} />;
}

// --- Main screen -------------------------------------------------------------
export default function SettingsScreen() {
  const router = useRouter();
  const { userName, userId, serverUrl, logout } = useAuthStore();
  const { clearRecentMoods } = useSessionStore();
  const { clearFeedback } = useFeedbackStore();
  const { resetOnboarding } = useOnboardingStore();
  const { prefs, loadPrefs, updatePrefs } = useSettingsStore();
  const { nowPlaying } = useNowPlayingStore();

  const [profileOpen, setProfileOpen] = useState(false);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [sensitivityOpen, setSensitivityOpen] = useState(false);

  // Mount anim
  const mountAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mountAnim, { toValue: 1, duration: 520, useNativeDriver: true }).start();
  }, []);
  const fadeUp = {
    opacity: mountAnim,
    transform: [{ translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };

  useEffect(() => { if (userId) loadPrefs(userId); }, [userId]);

  const color = avatarColor(userId);
  const initial = userName?.[0]?.toUpperCase() ?? "?";
  const serverDisplay = serverUrl?.replace(/^https?:\/\//, "") ?? "—";

  const RUNTIME_OPTIONS: { label: string; value: number | null }[] = [
    { label: "No limit", value: null },
    { label: "45 min",   value: 45 },
    { label: "90 min",   value: 90 },
    { label: "2 hours",  value: 120 },
    { label: "2.5 hours",value: 150 },
  ];
  const SENSITIVITY_OPTIONS: { label: string; value: "strict" | "relaxed" }[] = [
    { label: "Strict — hide skipped titles",  value: "strict" },
    { label: "Relaxed — rank lower instead",  value: "relaxed" },
  ];
  const runtimeLabel = RUNTIME_OPTIONS.find(o => o.value === prefs.maxRuntimeMinutes)?.label ?? "No limit";
  const sensitivityLabel = prefs.feedbackSensitivity === "strict" ? "Strict" : "Relaxed";

  const handleClearFeedback = () => {
    Alert.alert(
      "Clear watch feedback?",
      "All your ratings and skipped markers will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await clearFeedback();
        }},
      ]
    );
  };
  const handleClearMoods = () => {
    Alert.alert(
      "Clear mood history?",
      "Your recently used moods list will be reset.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await clearRecentMoods();
        }},
      ]
    );
  };
  const handleResetOnboarding = () => {
    Alert.alert(
      "Reset intro?",
      "The welcome tip will appear again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await resetOnboarding();
        }},
      ]
    );
  };
  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You'll need to sign in again to access Pomflix.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          logout();
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Background gradient */}
      <LinearGradient
        colors={[BG, BG2]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Nav bar */}
      <View style={s.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Your Space</Text>
        <View style={{ width: 64 }} />
      </View>

      <Animated.ScrollView
        style={[s.flex, fadeUp]}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile hero card ───────────────────────────────────── */}
        <TouchableOpacity
          style={s.profileCard}
          activeOpacity={0.88}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setProfileOpen(true); }}
        >
          {/* warm light leak — yellow → pinkish-red → fade */}
          <LinearGradient
            colors={["rgba(255,230,140,0.22)", "rgba(230,110,90,0.10)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: 100 }]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            pointerEvents="none"
          />
          {/* Avatar */}
          <View style={s.avatarWrap}>
            <LinearGradient
              colors={[color, RED]}
              style={s.avatarCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* sun flare streak */}
              <LinearGradient
                colors={["transparent", "rgba(255,255,220,0.0)", "rgba(255,248,200,0.28)", "rgba(255,255,240,0.06)", "transparent"]}
                style={s.avatarFlare}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                pointerEvents="none"
              />
              <Text style={s.avatarLetter}>{initial}</Text>
            </LinearGradient>
          </View>
          <View style={s.profileText}>
            <Text style={s.profileName}>{userName ?? "Unknown"}</Text>
            <Text style={s.profileRole}>Tap to view profile</Text>
          </View>
          <Text style={s.profileChevron}>›</Text>
        </TouchableOpacity>

        {/* ── Preferences ─────────────────────────────────────────── */}
        <Section title="PREFERENCES">
          <SettingsRow
            title="Max runtime"
            subtitle="Limits how long suggested content can be"
            value={runtimeLabel}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRuntimeOpen(true); }}
          />
          <Divider />
          <SettingsRow
            title="Suggestion sensitivity"
            subtitle={prefs.feedbackSensitivity === "strict"
              ? "Skipped titles are hidden from suggestions"
              : "Skipped titles are ranked lower"}
            value={sensitivityLabel}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSensitivityOpen(true); }}
          />
          <Divider />
          <SettingsRow
            title="Pinned & hidden moods"
            subtitle={prefs.pinnedMoodIds.length > 0
              ? `${prefs.pinnedMoodIds.length} pinned · ${prefs.hiddenMoodIds.length} hidden`
              : "Customise which moods appear on home"}
            chevron
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/settings/moods"); }}
          />
        </Section>

        {/* ── Your Data ───────────────────────────────────────────── */}
        <Section title="YOUR DATA">
          <SettingsRow
            title="Clear watch feedback"
            subtitle="Removes all ratings and skipped markers"
            destructive
            chevron
            onPress={handleClearFeedback}
          />
          <Divider />
          <SettingsRow
            title="Clear mood history"
            subtitle="Resets your recently used moods"
            destructive
            chevron
            onPress={handleClearMoods}
          />
          <Divider />
          <SettingsRow
            title="Reset intro tip"
            subtitle="Show the welcome card again"
            chevron
            onPress={handleResetOnboarding}
          />
        </Section>

        {/* ── Account ─────────────────────────────────────────────── */}
        <Section title="ACCOUNT">
          <SettingsRow
            title="Server"
            value={serverDisplay}
            subtitle="Your Jellyfin server"
            onPress={() => {}}
          />
        </Section>

        {/* ── Sign Out button ──────────────────────────────────────── */}
        <TouchableOpacity style={s.signOutBtn} activeOpacity={0.82} onPress={handleSignOut}>
          <LinearGradient
            colors={[RED, "#7A1525"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={s.footer}>Pomflix · Made with care</Text>
      </Animated.ScrollView>

      {/* ── Profile sheet ──────────────────────────────────────────── */}
      <ProfileSheet
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        userName={userName}
        userId={userId}
        serverUrl={serverUrl}
        avatarColor={color}
        avatarInitial={initial}
        nowPlaying={nowPlaying?.itemName ?? null}
      />

      {/* ── Runtime picker ──────────────────────────────────────────── */}
      <PickerSheet
        visible={runtimeOpen}
        title="Max Runtime"
        options={RUNTIME_OPTIONS}
        current={prefs.maxRuntimeMinutes}
        onSelect={(v) => userId && updatePrefs(userId, { maxRuntimeMinutes: v })}
        onClose={() => setRuntimeOpen(false)}
      />

      {/* ── Sensitivity picker ─────────────────────────────────────── */}
      <PickerSheet
        visible={sensitivityOpen}
        title="Suggestion Sensitivity"
        options={SENSITIVITY_OPTIONS}
        current={prefs.feedbackSensitivity}
        onSelect={(v) => userId && updatePrefs(userId, { feedbackSensitivity: v })}
        onClose={() => setSensitivityOpen(false)}
      />
    </SafeAreaView>
  );
}

// --- Styles ------------------------------------------------------------------
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  backBtn: { width: 64 },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: TEXT2,
  },
  navTitle: {
    flex: 1,
    fontFamily: Typography.display,
    fontSize: 20,
    color: TEXT,
    textAlign: "center",
    letterSpacing: -0.5,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 32,
  },

  // Profile hero card
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    overflow: "hidden",
  },
  avatarWrap: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarFlare: {
    position: "absolute",
    width: 100,
    height: 100,
    top: -20,
    left: -20,
  },
  avatarLetter: {
    fontFamily: Typography.displayBold,
    fontSize: 22,
    color: "#fff",
  },
  profileText: { gap: 5 },
  profileName: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: TEXT,
    letterSpacing: -0.4,
  },
  profileRole: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: TEXT2,
  },
  profileChevron: {
    fontSize: 22,
    color: TEXT3,
    lineHeight: 26,
  },

  // Sign Out
  signOutBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  signOutText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.2,
  },

  footer: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: TEXT3,
    textAlign: "center",
  },
});

const sec = StyleSheet.create({
  wrap: { gap: 10 },
  label: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: TEXT2,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    paddingHorizontal: 4,
  },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
});

const row = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 15,
    minHeight: 58,
  },
  left: { flex: 1, gap: 4, paddingRight: 12 },
  title: {
    fontFamily: Typography.sansMedium,
    fontSize: 16,
    color: TEXT,
    letterSpacing: -0.1,
  },
  titleDestructive: { color: RED_LIGHT },
  subtitle: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: TEXT2,
    lineHeight: 18,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  value: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: TEXT2,
  },
  chevron: {
    fontSize: 22,
    color: TEXT3,
    lineHeight: 24,
  },
});

// Picker sheet styles
const ps = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#18181B",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    paddingTop: 12,
    paddingHorizontal: 20,
    zIndex: 11,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 18,
  },
  sheetTitle: {
    fontFamily: Typography.display,
    fontSize: 17,
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  optionActive: {},
  optionLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: TEXT2,
  },
  optionLabelActive: { color: TEXT },
  optionCheck: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 16,
    color: "#A32035",
  },
});
