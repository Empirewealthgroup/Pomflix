import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { Mode } from "@/constants/modes";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - Spacing.screen * 2 - Spacing.sm) / 2;

interface ModeCardProps {
  mode: Mode;
}

export default function ModeCard({ mode }: ModeCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.wrapper}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push(`/mode/${mode.id}`);
      }}
      activeOpacity={0.82}
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

        {/* Icon */}
        <Text style={[styles.icon, { color: mode.colors.accent }]}>{mode.icon}</Text>

        {/* Label */}
        <View style={styles.labelArea}>
          <Text style={styles.label}>{mode.label}</Text>
          <Text style={[styles.tagline, { color: mode.colors.textAccent }]}>
            {mode.tagline}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
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
});
