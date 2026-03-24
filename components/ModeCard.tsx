import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import type { Mode } from "@/constants/modes";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - Spacing.screen * 2 - Spacing.sm) / 2;

// Show the long-press hint only once per app session
let _hintShown = false;

interface ModeCardProps {
  mode: Mode;
  isRecent?: boolean;
  isRecommended?: boolean;
  enterDelay?: number;
  onQuickPlay?: (modeId: string) => void;
  /** Called on press — parent animates a color transition then calls navigate() */
  onTransition?: (color: string, navigate: () => void) => void;
}

export default function ModeCard({
  mode,
  isRecent = false,
  isRecommended = false,
  enterDelay = 0,
  onQuickPlay,
  onTransition,
}: ModeCardProps) {
  const router = useRouter();

  // Entrance
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  // Press depth
  const scale = useRef(new Animated.Value(1)).current;
  const hintOpacity = useRef(new Animated.Value(_hintShown ? 0 : 1)).current;

  // Fade hint out after first viewing, never show again this session
  useEffect(() => {
    if (_hintShown) return;
    const t = setTimeout(() => {
      Animated.timing(hintOpacity, { toValue: 0, duration: 700, useNativeDriver: true })
        .start(() => { _hintShown = true; });
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay: enterDelay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay: enterDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () =>
    Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }).start();

  const handlePressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }).start();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const navigate = () => router.push(`/mode/${mode.id}`);
    if (onTransition) {
      onTransition(mode.colors.base, navigate);
    } else {
      navigate();
    }
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onQuickPlay?.(mode.id);
    const navigate = () =>
      router.push({ pathname: `/mode/${mode.id}`, params: { autoPlay: "1" } });
    if (onTransition) {
      onTransition(mode.colors.base, navigate);
    } else {
      navigate();
    }
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        delayLongPress={420}
        activeOpacity={1}
        style={styles.touchable}
      >
        <LinearGradient
          colors={[`${mode.colors.base}EE`, `${mode.colors.base}88`, Colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Glow blob */}
          <View
            style={[styles.glow, { backgroundColor: mode.colors.glow }]}
            pointerEvents="none"
          />

          {/* Recommended or Recent badge */}
          {isRecommended ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: `${mode.colors.accent}2A`,
                  borderColor: `${mode.colors.accent}66`,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: mode.colors.accent }]}>
                ✶ Now
              </Text>
            </View>
          ) : isRecent ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: `${mode.colors.accent}1A`,
                  borderColor: `${mode.colors.accent}44`,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: mode.colors.accent }]}>
                Recent
              </Text>
            </View>
          ) : null}

          {/* Icon */}
          <Text style={[styles.icon, { color: mode.colors.accent }]}>{mode.icon}</Text>

          {/* Label */}
          <View style={styles.labelArea}>
            <Text style={styles.label}>{mode.label}</Text>
            <Text style={[styles.tagline, { color: mode.colors.textAccent }]}>
              {mode.tagline}
            </Text>
            <Animated.Text style={[styles.holdHint, { opacity: hintOpacity }]}>Hold to play instantly</Animated.Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
    borderRadius: Radii.lg,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  touchable: {
    borderRadius: Radii.lg,
    overflow: "hidden",
  },
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.md,
    minHeight: 150,
    justifyContent: "space-between",
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
  },
  glow: {
    position: "absolute",
    top: -20,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.6,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    borderRadius: 20,
    borderWidth: 0.5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: Typography.sans,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  icon: {
    fontSize: 26,
    lineHeight: 30,
  },
  labelArea: { gap: 3 },
  label: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  tagline: {
    fontFamily: Typography.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  holdHint: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: "rgba(255,255,255,0.28)",
    marginTop: 6,
    letterSpacing: 0.2,
  },
});
