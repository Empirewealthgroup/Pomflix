import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Colors, Radii, Spacing } from "@/constants/theme";

interface SkeletonCardProps {
  width: number;
  height: number;
  borderRadius?: number;
}

function SkeletonBox({ width, height, borderRadius = Radii.md }: SkeletonCardProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.bone,
        { width, height, borderRadius, opacity },
      ]}
    />
  );
}

interface SkeletonCardFullProps {
  size?: "small" | "medium" | "large";
  width?: number;
}

const SIZES = {
  small: { width: 120, height: 180 },
  medium: { width: 160, height: 240 },
  large: { width: 300, height: 180 },
};

export default function SkeletonCard({ size = "medium", width }: SkeletonCardFullProps) {
  const dims = SIZES[size];
  const w = width ?? dims.width;

  return (
    <View style={[styles.wrapper, { width: w }]}>
      <SkeletonBox width={w} height={dims.height} />
      <SkeletonBox width={w * 0.75} height={10} borderRadius={4} />
      <SkeletonBox width={w * 0.5} height={9} borderRadius={4} />
    </View>
  );
}

export function SkeletonRow({ count = 4, size = "medium" }: { count?: number; size?: "small" | "medium" | "large" }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: Colors.surfaceRaised,
  },
  wrapper: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
  },
});
